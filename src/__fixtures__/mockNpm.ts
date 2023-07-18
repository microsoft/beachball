import { afterAll, afterEach, beforeAll, jest } from '@jest/globals';
import fs from 'fs-extra';
import _ from 'lodash';
import path from 'path';
import semver from 'semver';
import { NpmShowResult } from '../packageManager/listPackageVersions';
import { npm, NpmResult } from '../packageManager/npm';
import { PackageJson } from '../types/PackageInfo';

/** Published versions and dist-tags for a package */
type NpmPackageVersionsData = Pick<NpmShowResult, 'versions' | 'dist-tags'>;

type MockNpmRegistryPackage = NpmPackageVersionsData & {
  /** Mapping from version to full package data */
  versionData: Record<string, PackageJson>;
};

/** Mapping from package name to registry data */
type MockNpmRegistry = Record<string, MockNpmRegistryPackage>;

/** Mapping from package name to partial registry data (easier to specify in tests) */
type PartialRegistryData = Record<string, Partial<NpmPackageVersionsData>>;

/**
 * Mock implementation of an npm command.
 * @param registryData Fake registry data to operate on
 * @param args Command line args, *excluding* the command name
 * @param opts Command line options, notably `cwd` for publish
 */
type MockNpmCommand = (registryData: MockNpmRegistry, args: string[], opts: Parameters<typeof npm>[1]) => NpmResult;

export type NpmMock = {
  /**
   * Mocked `npm()` function.
   */
  mock: jest.MockedFunction<typeof npm>;
  /**
   * Set a temporary override for a specific mock npm command.
   * This will be reset after each test.
   */
  setCommandOverride: (command: string, override: MockNpmCommand) => void;
  /**
   * Set registry data as a mapping from package name to package data.
   *
   * This should be used for tests covering only the `show` command.
   * For tests also covering `publish`, it's better to call the mocked npm publish command
   * to add package versions to ensure all relevant data is included.
   */
  setRegistryData: (registryData: PartialRegistryData) => void;
};

/**
 * Mock the `npm show` and `npm publish` commands for `npm()` calls.
 * Other commands could potentially be mocked in the future.
 *
 * These mocks operate on a fake registry data object, which can be set using `setRegistryData()`
 * and is reset after each test.
 *
 * This setup helper must be called at the top level of a `describe()` block because it handles
 * its own setup/teardown (and resetting between tests) using lifecycle functions.
 */
export function initNpmMock(): NpmMock {
  const npmMock = npm as jest.MockedFunction<typeof npm>;
  if (!npmMock.mock) {
    throw new Error(
      "npm() is not currently mocked. You must call jest.mock('<relativePathTo>/packageManager/npm') at the top of your test."
    );
  }

  const defaultMocks: Record<string, MockNpmCommand> = {
    show: _mockNpmShow,
    publish: _mockNpmPublish,
  };
  let overrideMocks: Record<string, MockNpmCommand> = {};
  let registryData: MockNpmRegistry = {};

  beforeAll(() => {
    npmMock.mockImplementation(async ([command, ...args], opts) => {
      const func = overrideMocks[command] || defaultMocks[command];
      if (!func) {
        throw new Error(`Command not supported by mock npm: ${command}`);
      }
      return func(registryData, args, opts);
    });
  });

  afterEach(() => {
    registryData = {};
    overrideMocks = {};
    npmMock.mockClear();
  });

  afterAll(() => {
    npmMock.mockRestore();
  });

  return {
    mock: npmMock,
    setCommandOverride: (command, override) => {
      overrideMocks[command] = override;
    },
    setRegistryData: data => {
      registryData = _makeRegistryData(data);
    },
  };
}

/** (exported for testing) Make full registry data from partial data */
export function _makeRegistryData(data: PartialRegistryData): MockNpmRegistry {
  return _.mapValues(data, (pkg, name): MockNpmRegistryPackage => {
    let versions = pkg.versions;
    let distTags = pkg['dist-tags'];
    if (!versions && !distTags) {
      throw new Error(`setRegistryData() must include either versions or dist-tags for ${name}`);
    }

    // Include all versions from either `versions` or `dist-tags`, deduped and sorted
    distTags ??= {};
    const versionsSet = new Set([...(versions || []), ...Object.values(distTags)]);
    versions = semver.sort([...versionsSet]);
    // Ensure "latest" is set
    distTags.latest ??= versions.slice(-1)[0];

    return {
      versions,
      'dist-tags': distTags,
      // Fill in basic package.json data for each version
      versionData: Object.fromEntries(versions.map(version => [version, { name, version }])),
    };
  });
}

/** (exported for testing) Mock npm show based on the registry data */
export const _mockNpmShow: MockNpmCommand = (registryData, args) => {
  // Assumption: all beachball callers to "npm show" list the package name last
  const packageSpec = args.slice(-1)[0];

  // The requested package may be only a name, or may include a version (either tag or semver).
  // Split at any @ later in the string (@ at the start is a scope) to see if there's a version,
  // or default to latest if no version is specified.
  const [name, version = 'latest'] = packageSpec.split(/(?!^)@/);
  const pkgData = registryData[name];

  if (!pkgData) {
    const stderr = `[fake] code E404 - ${name} - not found`;
    return { stdout: '', stderr, all: stderr, success: false, failed: true } as NpmResult;
  }

  let finalVersion: string | undefined;
  if (semver.valid(version)) {
    // syntactically valid single version
    finalVersion = version;
  } else if (semver.validRange(version)) {
    // syntactically valid range: could be implemented but no test is using it
    throw new Error('Ranges are not currently supported by mock npm');
  } else {
    // try it as a dist-tag
    finalVersion = pkgData['dist-tags'][version];
  }

  const versionData = finalVersion ? pkgData.versionData[finalVersion] : undefined;
  if (!versionData) {
    // Some versions for this package exist, but the specified version or tag doesn't
    // (note that "E404" matches the actual npm output, but the rest of the message is different)
    const stderr = `[fake] code E404 - ${name}@${version} - not found`;
    return { stdout: '', stderr, all: stderr, success: false, failed: true } as NpmResult;
  }

  const stdout = JSON.stringify({
    // NOTE: if key order changes here, the test must be updated
    ...versionData,
    'dist-tags': pkgData['dist-tags'],
    versions: pkgData.versions,
  });
  return { stdout, stderr: '', all: stdout, success: true, failed: false } as NpmResult;
};

/** (exported for testing) Mock npm publish to the registry data */
export const _mockNpmPublish: MockNpmCommand = (registryData, args: string[], opts: Parameters<typeof npm>[1]) => {
  if (!opts?.cwd) {
    throw new Error('cwd is required for mock npm publish');
  }

  // Read package.json from cwd to find the published package name and version.
  // (If this fails, let the exception propagate for easier debugging.)
  const packageJson = fs.readJsonSync(path.join(opts.cwd, 'package.json')) as PackageJson;
  const { name, version } = packageJson;

  if (registryData[name]?.versions?.includes(version)) {
    // note that EPUBLISHCONFLICT matches the actual npm output, but the rest of the message is different
    const stderr = `[fake] EPUBLISHCONFLICT ${name}@${version} already exists in registry`;
    return { stdout: '', stderr, all: stderr, success: false, failed: true } as NpmResult;
  }

  let tag = '';
  for (let i = 0; !tag && i < args.length; i++) {
    if (args[i] === '--tag' && i < args.length - 1) {
      tag = args[i + 1];
    } else if (args[i].startsWith('--tag=')) {
      tag = args[i].replace(/^--tag=/, '');
    }
  }
  tag ||= 'latest';

  registryData[name] ??= { versions: [], 'dist-tags': {}, versionData: {} };
  registryData[name].versions.push(version);
  registryData[name]['dist-tags'][tag] = version;
  registryData[name].versionData[version] = packageJson;

  const stdout = `[fake] published ${name}@${version} with tag ${tag}`;
  return { stdout, stderr: '', all: stdout, success: true, failed: false } as NpmResult;
};
