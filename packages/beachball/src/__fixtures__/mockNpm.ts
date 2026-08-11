import { afterAll, afterEach, beforeAll, jest } from '@jest/globals';
import { readJson } from '@microsoft/beachball-test-utilities';
import fs from 'node:fs';
import path from 'node:path';
import semver from 'semver';
import type { NpmShowJsonError } from '../packageManager/getNpmPackageInfo';
import { npm } from '../packageManager/npm';
import type { SpawnOptions, SpawnResult } from '../spawn';
import type { PackageJson } from '../types/PackageInfo';
import { mockSpawnSuccess, MockSubprocessError } from './mockSpawnResult';

interface MockNpmPackageData {
  name: string;
  versions: Record<string, PackageJson>;
  'dist-tags': Record<string, string>;
}

/** Mapping from package name to registry data */
type MockNpmRegistry = Record<string, MockNpmPackageData>;

/** Mapping from package name to partial registry data (easier to specify in tests) */
type PartialRegistryData = Record<string, Partial<{ versions: string[]; 'dist-tags': Record<string, string> }>>;

/**
 * Mock implementation of an npm command.
 * @param registryData Fake registry data to operate on
 * @param args Command line args, *excluding* the command name
 * @param opts Command line options, notably `cwd` for publish
 */
export type MockNpmCommand = (
  registryData: MockNpmRegistry,
  args: string[],
  opts: SpawnOptions & { cwd: string }
) => Promise<SpawnResult>;

export type NpmMock = {
  /**
   * Mocked `npm()` function.
   */
  mock: jest.MockedFunction<typeof npm>;
  /** Mocked global `fetch()` function. */
  mockFetch: jest.MockedFunction<typeof fetch>;
  /**
   * Publish this package version to the mock registry (without needing to read from the filesystem
   * or properly structure the data for `setRegistryData`). This will throw on error.
   */
  publishPackage: (packageJson: PackageJson, tag?: string) => void;
  /**
   * Set a temporary override for a specific mock npm command.
   * This will be reset after each test.
   */
  setCommandOverride: (command: string, override: MockNpmCommand) => void;
  /**
   * Set registry data as a mapping from package name to package data.
   *
   * This is mainly intended for tests covering the `show` command or simple publishing scenarios.
   * For more complex scenarios, it's better to use `publishPackage` to add package versions.
   */
  setRegistryData: (registryData: PartialRegistryData) => void;
  /**
   * Get the mock-published versions and tags for a package.
   */
  getPublishedVersions: (
    packageName: string
  ) => { versions: string[]; 'dist-tags': Record<string, string> } | undefined;
  /**
   * Get the mock-published manifest for a package.
   * @param versionOrTag Specific version or tag (defaults to `latest`)
   */
  getPublishedPackage: (packageName: string, versionOrTag?: string) => PackageJson | undefined;
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
  const fetchMock = jest.spyOn(globalThis, 'fetch') as jest.MockedFunction<typeof fetch>;

  const defaultMocks: Record<string, MockNpmCommand> = {
    publish: _mockNpmPublish,
    pack: _mockNpmPack,
    show: _mockNpmShow,
  };
  let overrideMocks: Record<string, MockNpmCommand> = {};
  let registryData: MockNpmRegistry = {};

  beforeAll(() => {
    npmMock.mockImplementation(async ([command, ...args], opts) => {
      const func = overrideMocks[command] || defaultMocks[command];
      if (!func) {
        throw new Error(`Command not supported by mock npm: ${command}`);
      }
      return await func(registryData, args, opts);
    });

    fetchMock.mockImplementation(input => {
      const url = new URL(input instanceof URL ? input : typeof input === 'string' ? input : input.url);

      for (const [packageName, packageData] of Object.entries(registryData)) {
        // Check if this package from the registry data matches the requested package
        const versionOrTag = decodeURIComponent(url.pathname.split(`/${encodeURIComponent(packageName)}/`)[1] || '');
        if (!versionOrTag) {
          continue;
        }
        const version = packageData['dist-tags'][versionOrTag] || versionOrTag;
        const manifest = packageData.versions[version];
        return Promise.resolve(
          new Response(manifest ? JSON.stringify(manifest) : undefined, {
            status: manifest ? 200 : 404,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }

      return Promise.resolve(new Response(undefined, { status: 404 }));
    });
  });

  afterEach(() => {
    registryData = {};
    overrideMocks = {};
    npmMock.mockClear();
    fetchMock.mockClear();
  });

  afterAll(() => {
    npmMock.mockRestore();
    fetchMock.mockRestore();
  });

  return {
    mock: npmMock,
    mockFetch: fetchMock,
    publishPackage: (packageJson, tag = 'latest') => {
      mockPublishPackage(registryData, packageJson, tag);
    },
    setCommandOverride: (command, override) => {
      overrideMocks[command] = override;
    },
    setRegistryData: data => {
      registryData = _makeRegistryData(data);
    },
    getPublishedVersions: packageName => {
      const pkgData = registryData[packageName];
      if (!pkgData) return undefined;
      return {
        versions: Object.keys(pkgData.versions),
        'dist-tags': pkgData['dist-tags'],
      };
    },
    getPublishedPackage: (packageName, versionOrTag = 'latest') => {
      const pkgData = registryData[packageName];
      if (!pkgData) return undefined;

      const version = pkgData['dist-tags'][versionOrTag] || versionOrTag;
      return pkgData.versions[version];
    },
  };
}

/** (exported for testing) Make full registry data from partial data */
export function _makeRegistryData(data: PartialRegistryData): MockNpmRegistry {
  const registry: MockNpmRegistry = {};

  for (const [name, pkg] of Object.entries(data)) {
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

    registry[name] = {
      name,
      // Fill in basic package.json data for each version
      versions: Object.fromEntries(versions.map(version => [version, { name, version }])),
      'dist-tags': distTags,
    };
  }

  return registry;
}

/** (exported for testing) Mock npm show based on the registry data */
// eslint-disable-next-line @typescript-eslint/require-await -- required by signature
export const _mockNpmShow: MockNpmCommand = async (registryData, args) => {
  // Assumption: all beachball callers to "npm show" list the package name
  // as the last argument except for the properties to show.
  let packageSpec = '';
  for (let i = args.length - 1; i >= 0; i--) {
    if (!['name', 'version'].includes(args[i])) {
      packageSpec = args[i];
      break;
    }
  }

  // The requested package may be only a name, or may include a version (either tag or semver).
  // Split at any @ later in the string (@ at the start is a scope) to see if there's a version,
  // or default to latest if no version is specified.
  const [name, version = 'latest'] = packageSpec.split(/(?!^)@/);
  const pkgData = registryData[name];

  if (!pkgData) {
    return mockNpmShowError(name, version);
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

  const versionData = finalVersion ? pkgData.versions[finalVersion] : undefined;
  if (!versionData) {
    return mockNpmShowError(name, version);
  }

  const stdout = JSON.stringify({
    ...versionData,
    'dist-tags': pkgData['dist-tags'],
    versions: Object.keys(pkgData.versions),
  });
  return mockSpawnSuccess({ output: stdout });
};

export function mockNpmShowError(
  packageName: string,
  version: string,
  errorOverride?: NpmShowJsonError['error']
): MockSubprocessError {
  const packageSpec = `${packageName}@${version}`;
  const stdout = JSON.stringify({
    error: errorOverride || {
      code: 'E404',
      summary: `No match found for version ${version}`,
      detail:
        `'${packageSpec}' is not in this registry.\n\n` +
        'Note that you can also install from a\ntarball, folder, http url, or git url.',
    },
  } satisfies NpmShowJsonError);
  const result = new MockSubprocessError({ output: stdout });
  result.stdout = stdout;
  return result;
}

/** (exported for testing) Mock npm publish to the registry data */
// eslint-disable-next-line @typescript-eslint/require-await -- async required by signature
export const _mockNpmPublish: MockNpmCommand = async (registryData, args, opts) => {
  if (!opts?.cwd) {
    // This is to ensure it's passed in real scenarios
    throw new Error('cwd is required for mock npm publish');
  }

  // Read package.json from cwd to find the published package name and version.
  // (If this fails, let the exception propagate for easier debugging.)
  const packageJson = readJson<PackageJson>(path.join(opts.cwd, 'package.json'));

  const tag = args.includes('--tag') ? args[args.indexOf('--tag') + 1] : 'latest';

  try {
    const output = mockPublishPackage(registryData, packageJson, tag);
    return mockSpawnSuccess({ output });
  } catch (err) {
    return new MockSubprocessError({ output: (err as Error).message });
  }
};

/** Publish a new package version to the mock registry */
function mockPublishPackage(registryData: MockNpmRegistry, packageJson: PackageJson, tag: string) {
  const { name, version } = packageJson;

  if (registryData[name]?.versions?.[version]) {
    // note that EPUBLISHCONFLICT matches the actual npm output, but the rest of the message is different
    throw new Error(`[fake] EPUBLISHCONFLICT ${name}@${version} already exists in registry`);
  }

  registryData[name] ??= { name, versions: {}, 'dist-tags': {} };
  registryData[name].versions[version] = packageJson;
  registryData[name]['dist-tags'][tag] = version;

  return `[fake] published ${name}@${version} with tag ${tag}`;
}

/**
 * Return a .tgz filename following npm's naming scheme.
 */
export function getMockNpmPackName(packageJson: PackageJson): string {
  const { name, version } = packageJson;
  // Note this may be less name sanitization than npm does, but it doesn't matter for tests.
  const safeName = name.startsWith('@') ? name.slice(1).replace('/', '-') : name;
  return `${safeName}-${version}.tgz`;
}

// eslint-disable-next-line @typescript-eslint/require-await -- required by signature
export const _mockNpmPack: MockNpmCommand = async (registryData, args, opts) => {
  if (!opts?.cwd) {
    // This is to ensure it's passed in real scenarios
    throw new Error('cwd is required for mock npm pack');
  }

  // Read package.json from cwd to find the package name and version.
  // (If this fails, let the exception propagate for easier debugging.)
  const packageJson = readJson<PackageJson>(path.join(opts.cwd, 'package.json'));

  // Create a fake ".tgz" file with npm's naming scheme (contents don't matter).
  const packFileName = getMockNpmPackName(packageJson);
  fs.writeFileSync(path.join(opts.cwd, packFileName), 'fake package contents');

  return mockSpawnSuccess({ output: packFileName });
};
