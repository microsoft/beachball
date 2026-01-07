import { describe, it, expect, jest, afterEach, beforeAll } from '@jest/globals';
import _fs from 'fs';
import path from 'path';
import type { RepoOptions } from '../../types/BeachballOptions';
import { defaultRemoteBranchName } from '../../__fixtures__/gitDefaults';
import { makePackageInfos, type PartialPackageInfos } from '../../__fixtures__/packageInfos';
import type { BumpInfo } from '../../types/BumpInfo';
import { getParsedOptions } from '../../options/getOptions';
import { performBump } from '../../bump/performBump';
import { ChangeSet, type ChangeFileInfo } from '../../types/ChangeInfo';
import { consideredDependencies, type PackageInfos, type PackageJson } from '../../types/PackageInfo';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import { updateLockFile as _updateLockFile } from '../../bump/updateLockFile';
import { writeJson as _writeJson, writeJson } from '../../object/writeJson';
import { writeChangelog as mockWriteChangelog } from '../../changelog/writeChangelog';

jest.mock('fs');
jest.mock('../../object/writeJson');
// These tests don't cover writeChangelog
jest.mock('../../changelog/writeChangelog');
// Mock updateLockFile to verify it's called
jest.mock('../../bump/updateLockFile');

const mockFs = _fs as jest.Mocked<typeof _fs>;
const mockWriteJson = _writeJson as jest.MockedFunction<typeof _writeJson>;
const mockUpdateLockFile = _updateLockFile as jest.MockedFunction<typeof _updateLockFile>;

type PrebumpHook = NonNullable<NonNullable<RepoOptions['hooks']>['prebump']>;
type PostbumpHook = NonNullable<NonNullable<RepoOptions['hooks']>['postbump']>;

//
// Test basic in-memory scenarios for performBump.
// These tests DO NOT cover changelog generation! (use writeChangelog.test.ts, or bump.test.ts for E2E)
//
describe('performBump', () => {
  initMockLogs();

  /** Fake root path in OS format */
  const fakeRoot = path.resolve('/fake/root');

  /** Package infos for current test */
  let packageInfos: PackageInfos | undefined;

  /** Get the package.json from `packageInfos` for the given package name */
  function packageJsonFor(pkgName: string) {
    const pkg = packageInfos?.[pkgName];
    if (!pkg) {
      throw new Error(`No package info for ${pkgName}`);
    }
    // remove beachball keys and undefined values
    const includedKeys: (keyof PackageJson)[] = ['name', 'version', 'private', ...consideredDependencies];
    return Object.fromEntries(
      Object.entries(pkg).filter(
        ([key, value]) => includedKeys.includes(key as keyof PackageJson) && value !== undefined
      )
    );
  }

  /**
   * Call `performBump` with minimal mock params (omitting thing only needed for `writeChangelog`).
   * Also populate the shared `packageInfos` used to mock `fs.readFileSync`.
   *
   * `modifiedPackages` defaults to all packages in `packageInfos`.
   */
  function performBumpWrapper(params: {
    packageInfos: PartialPackageInfos;
    modifiedPackages?: BumpInfo['modifiedPackages'];
    /** Names to generate empty `changeFileChangeInfos` */
    changeFileNames?: string[];
    repoOptions?: Partial<RepoOptions>;
  }) {
    const opts = getParsedOptions({
      cwd: fakeRoot,
      argv: [],
      testRepoOptions: { branch: defaultRemoteBranchName, ...params.repoOptions },
    });

    packageInfos = makePackageInfos(params.packageInfos, opts.cliOptions);

    return performBump(
      {
        // performBump only directly uses packageInfos, modifiedPackages, and names from changeFileChangeInfos.
        packageInfos,
        modifiedPackages: params.modifiedPackages || new Set(Object.keys(packageInfos)),
        changeFileChangeInfos: (params.changeFileNames || []).map<ChangeSet[number]>(name => ({
          changeFile: name,
          change: {} as ChangeFileInfo,
        })),
        calculatedChangeTypes: {},
        dependentChangedBy: {},
        packageGroups: {},
        scopedPackages: new Set(),
      },
      opts.options
    );
  }

  /** Get hook calls without the final `packageInfos` param for simpler diffs */
  function getHookCalls(hook: jest.Mock<PostbumpHook>) {
    return hook.mock.calls.map(call => call.slice(0, 3));
  }

  beforeAll(() => {
    // Only say package.json files exist
    mockFs.existsSync.mockImplementation(filePath => String(filePath).endsWith('package.json'));

    // Mock readFileSync to return package.json based on packageInfos
    mockFs.readFileSync.mockImplementation((filePath => {
      filePath = String(filePath);
      if (!filePath.endsWith('package.json')) {
        throw new Error(`readFileSync not mocked for ${filePath}`);
      }
      const packageJson = packageJsonFor(path.basename(path.dirname(filePath)));
      return JSON.stringify(packageJson);
    }) as typeof _fs.readFileSync);
  });

  afterEach(() => {
    jest.clearAllMocks();
    packageInfos = undefined;
  });

  it('updates package.json files for modified packages only', async () => {
    await performBumpWrapper({
      packageInfos: { pkg1: { version: '1.0.0' }, pkg2: { version: '2.0.0' }, pkg3: { version: '3.0.0' } },
      modifiedPackages: new Set(['pkg2', 'pkg3']),
    });

    const mockCalls = mockWriteJson.mock.calls.filter(call => call[0].endsWith('package.json'));
    expect(mockCalls).toEqual([
      [packageInfos!.pkg2.packageJsonPath, packageJsonFor('pkg2')],
      [packageInfos!.pkg3.packageJsonPath, packageJsonFor('pkg3')],
    ]);

    // other expected mocks
    expect(mockWriteChangelog).toHaveBeenCalled();
    expect(mockUpdateLockFile).toHaveBeenCalled();
  });

  it('respects generateChangelog: false', async () => {
    await performBumpWrapper({
      packageInfos: { pkg1: { version: '1.0.0' } },
      repoOptions: { generateChangelog: false },
    });

    expect(mockWriteChangelog).not.toHaveBeenCalled();
    expect(writeJson).toHaveBeenCalled(); // the package was updated
  });

  it('updates lock file after package.jsons', async () => {
    // eslint-disable-next-line @typescript-eslint/require-await -- match signature
    mockUpdateLockFile.mockImplementationOnce(async () => {
      // verify package.json was updated first
      expect(mockWriteJson).toHaveBeenCalledWith(expect.stringMatching(/package.json$/), expect.anything());
    });

    try {
      await performBumpWrapper({ packageInfos: { pkg1: {} } });
      expect(mockUpdateLockFile).toHaveBeenCalled();
    } finally {
      // Ensure the mock is cleaned up
      mockUpdateLockFile.mockReset();
    }
  });

  it('deletes change files after bump by default', async () => {
    await performBumpWrapper({
      packageInfos: { pkg1: {} },
      changeFileNames: ['change1.json', 'change2.json'],
    });
    const changePath = path.join(fakeRoot, 'change');
    expect(mockFs.rmSync).toHaveBeenCalledWith(path.join(changePath, 'change1.json'), expect.anything());
    expect(mockFs.rmSync).toHaveBeenCalledWith(path.join(changePath, 'change2.json'), expect.anything());
  });

  it('keeps change files with keepChangeFiles option', async () => {
    await performBumpWrapper({
      packageInfos: { pkg1: {} },
      changeFileNames: ['change1.json', 'change2.json'],
      repoOptions: { keepChangeFiles: true },
    });
    expect(mockFs.rmSync).not.toHaveBeenCalled();
  });

  // Currently prebump is using the wrong version, so the test/mocks might need updating
  // https://github.com/microsoft/beachball/issues/1116
  it('calls prebump hook for each package before writing', async () => {
    const hook = jest.fn<PrebumpHook>(() => {
      expect(mockWriteJson).not.toHaveBeenCalled();
      expect(mockWriteChangelog).not.toHaveBeenCalled();
      expect(mockUpdateLockFile).not.toHaveBeenCalled();
    });

    await performBumpWrapper({
      packageInfos: { pkg1: { version: '1.0.0' }, pkg2: { version: '2.0.0' }, pkg3: { version: '1.0.0' } },
      modifiedPackages: new Set(['pkg2', 'pkg3']),
      changeFileNames: ['change1', 'change2'],
      repoOptions: { hooks: { prebump: hook } },
    });

    // currently this is getting the extra packageInfos arg even though it's not in signature
    expect(getHookCalls(hook)).toEqual([
      [expect.stringMatching(/pkg2$/), 'pkg2', '2.0.0'],
      [expect.stringMatching(/pkg3$/), 'pkg3', '1.0.0'],
    ]);
  });

  it('calls postbump hook for each package after writing', async () => {
    const hook = jest.fn<PostbumpHook>(() => {
      expect(mockWriteChangelog).toHaveBeenCalled();
      expect(mockUpdateLockFile).toHaveBeenCalled();
      expect(mockWriteJson).toHaveBeenCalledWith(packageInfos!.pkg2.packageJsonPath, expect.anything());
      expect(mockWriteJson).toHaveBeenCalledWith(packageInfos!.pkg3.packageJsonPath, expect.anything());
    });

    await performBumpWrapper({
      packageInfos: { pkg1: { version: '1.0.0' }, pkg2: { version: '2.0.0' }, pkg3: { version: '1.0.0' } },
      modifiedPackages: new Set(['pkg2', 'pkg3']),
      changeFileNames: ['change1', 'change2'],
      repoOptions: { hooks: { postbump: hook } },
    });

    expect(getHookCalls(hook)).toEqual([
      [expect.stringMatching(/pkg2$/), 'pkg2', '2.0.0'],
      [expect.stringMatching(/pkg3$/), 'pkg3', '1.0.0'],
    ]);
  });

  // Scenarios (including exceptions) with concurrency are covered in callHook.
  // performBump just has to pass the required `concurrency` param through.
  it.each(['prebump', 'postbump'] as const)('propagates %s hook exceptions', async hookName => {
    const repoOptions: Partial<RepoOptions> = {
      hooks: {
        [hookName]: () => Promise.reject(new Error('oh no')),
      },
    };

    await expect(() => performBumpWrapper({ packageInfos: { pkg1: {} }, repoOptions })).rejects.toThrow('oh no');
  });
});
