import type { jest } from '@jest/globals';
import { afterAll, afterEach, beforeAll } from '@jest/globals';
import fs from 'fs';
import fetch from 'npm-registry-fetch';
import path from 'path';
import semver from 'semver';
import { npm, type NpmResult } from '../packageManager/npm';
import type { PackageJson } from '../types/PackageInfo';
import type { PackageManagerOptions } from '../packageManager/packageManager';
import { readJson } from '../object/readJson';
import type { NpmPackageVersionsData, NpmRegistryFetchJson } from '../packageManager/getNpmPackageInfo';

/** Mapping from package name to registry data */
type MockNpmRegistry = Record<string, NpmRegistryFetchJson>;

/** Mapping from package name to partial registry data (easier to specify in tests) */
type PartialRegistryData = Record<string, Partial<NpmPackageVersionsData>>;

export type MockNpmResult = Pick<NpmResult, 'stdout' | 'stderr' | 'all' | 'success' | 'failed'>;

/**
 * Mock implementation of an npm command.
 * @param registryData Fake registry data to operate on
 * @param args Command line args, *excluding* the command name
 * @param opts Command line options, notably `cwd` for publish
 */
export type MockNpmCommand = (
  registryData: MockNpmRegistry,
  args: string[],
  opts: PackageManagerOptions
) => Promise<MockNpmResult>;

export type NpmMock = {
  /**
   * Mocked `npm()` function.
   */
  mock: jest.MockedFunction<typeof npm>;
  /**
   * Mocked `fetch.json()` function.
   */
  mockFetchJson: jest.MockedFunction<typeof fetch.json>;
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
  getPublishedVersions: (packageName: string) => NpmPackageVersionsData | undefined;
  /**
   * Get the mock-published manifest for a package.
   * @param versionOrTag Specific version or tag (defaults to `latest`)
   */
  getPublishedPackage: (packageName: string, versionOrTag?: string) => PackageJson | undefined;
};

/** This sort of follows the non-exported errors from `npm-registry-fetch` */
class MockRegistryFetchError extends Error {
  statusCode: number;
  code: string;
  constructor(message: string, code: number) {
    super(message);
    this.name = 'MockRegistryFetchError';
    this.statusCode = code;
    this.code = `E${code}`;
  }
}

/** Generic modified date for packages (not currently used) */
const modified = '2025-12-13T08:26:17.647Z';

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
  const fetchMock = fetch as jest.MockedFunction<typeof fetch>;
  if (!fetchMock.mock) {
    throw new Error(
      "npm-registry-fetch is not currently mocked. You must call jest.mock('npm-registry-fetch') at the top of your test."
    );
  }

  const defaultMocks: Record<string, MockNpmCommand> = {
    publish: _mockNpmPublish,
    pack: _mockNpmPack,
  };
  let overrideMocks: Record<string, MockNpmCommand> = {};
  let registryData: MockNpmRegistry = {};

  beforeAll(() => {
    npmMock.mockImplementation(async ([command, ...args], opts) => {
      const func = overrideMocks[command] || defaultMocks[command];
      if (!func) {
        throw new Error(`Command not supported by mock npm: ${command}`);
      }
      return (await func(registryData, args, opts)) as NpmResult;
    });

    const fetchJson = (url: string): Promise<NpmRegistryFetchJson> => {
      const packageName = decodeURIComponent(url).replace(/^\//, '');
      const pkgData = registryData[packageName];
      if (!pkgData) {
        throw new MockRegistryFetchError(`404 Not Found - GET ${url}`, 404);
      }
      return Promise.resolve(pkgData);
    };
    // We skipped the fetch.json.stream property since it's not used
    fetchMock.json.mockImplementation(fetchJson as unknown as typeof fetch.json);
  });

  afterEach(() => {
    registryData = {};
    overrideMocks = {};
    npmMock.mockClear();
    fetchMock.json.mockClear();
  });

  afterAll(() => {
    npmMock.mockRestore();
    fetchMock.json.mockRestore();
  });

  return {
    mock: npmMock,
    mockFetchJson: fetchMock.json,
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
      modified,
      // Fill in basic package.json data for each version
      versions: Object.fromEntries(versions.map(version => [version, { name, version }])),
      'dist-tags': distTags,
    };
  }

  return registry;
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
    const stdout = mockPublishPackage(registryData, packageJson, tag);
    return { stdout, stderr: '', all: stdout, success: true, failed: false };
  } catch (err) {
    const stderr = (err as Error).message;
    return { stdout: '', stderr, all: stderr, success: false, failed: true };
  }
};

/** Publish a new package version to the mock registry */
function mockPublishPackage(registryData: MockNpmRegistry, packageJson: PackageJson, tag: string) {
  const { name, version } = packageJson;

  if (registryData[name]?.versions?.[version]) {
    // note that EPUBLISHCONFLICT matches the actual npm output, but the rest of the message is different
    throw new Error(`[fake] EPUBLISHCONFLICT ${name}@${version} already exists in registry`);
  }

  registryData[name] ??= { name, modified, versions: {}, 'dist-tags': {} };
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

  return { stdout: packFileName, stderr: '', all: packFileName, success: true, failed: false };
};
