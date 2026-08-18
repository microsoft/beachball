import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { initMockLogs } from '@microsoft/beachball-test-utilities';
import * as wsTools from 'workspace-tools';
import { generateChangeSet } from '../../__fixtures__/changeFiles';
import type { PartialPackageInfos } from '../../__fixtures__/packageInfos';
import { bumpInMemory } from '../../bump/bumpInMemory';
import { getChangedPackages } from '../../changefile/getChangedPackages';
import { readChangeFiles } from '../../changefile/readChangeFiles';
import { getMigrationIssues } from '../../commands/migrate';
import { getRawPackageInfos } from '../../monorepo/getPackageInfos';
import { getPackagesToPublish } from '../../publish/getPackagesToPublish';
import { BeachballError } from '../../types/BeachballError';
import type { BeachballOptions, RepoOptions } from '../../types/BeachballOptions';
import type { ChangeType } from '../../types/ChangeInfo';
import { areChangeFilesDeleted } from '../../validation/areChangeFilesDeleted';
import { validate, type ValidateOptions } from '../../validation/validate';
import type { AuthType } from '../../types/Auth';
import { getOptions } from '../../options/getOptions';
import { defaultRemoteBranchName } from '../../__fixtures__/gitDefaults';

jest.mock('workspace-tools');
jest.mock('../../bump/bumpInMemory');
jest.mock('../../changefile/getChangedPackages');
jest.mock('../../changefile/readChangeFiles');
jest.mock('../../commands/migrate');
jest.mock('../../monorepo/getPackageInfos', () => ({
  ...jest.requireActual<typeof import('../../monorepo/getPackageInfos')>('../../monorepo/getPackageInfos'),
  getRawPackageInfos: jest.fn(),
}));
jest.mock('../../publish/getPackagesToPublish');
jest.mock('../../validation/areChangeFilesDeleted');

const mockWsTools = wsTools as jest.Mocked<typeof wsTools>;
const mockBumpInMemory = bumpInMemory as jest.MockedFunction<typeof bumpInMemory>;
const mockGetChangedPackages = getChangedPackages as jest.MockedFunction<typeof getChangedPackages>;
const mockReadChangeFiles = readChangeFiles as jest.MockedFunction<typeof readChangeFiles>;
const mockGetMigrationIssues = getMigrationIssues as jest.MockedFunction<typeof getMigrationIssues>;
const mockGetRawPackageInfos = getRawPackageInfos as jest.MockedFunction<typeof getRawPackageInfos>;
const mockGetPackagesToPublish = getPackagesToPublish as jest.MockedFunction<typeof getPackagesToPublish>;
const mockAreChangeFilesDeleted = areChangeFilesDeleted as jest.MockedFunction<typeof areChangeFilesDeleted>;

describe('validate', () => {
  const logs = initMockLogs();

  async function validateWrapper(params?: {
    repoOptions?: Partial<RepoOptions>;
    validateOptions?: ValidateOptions;
    cliOptions?: string[];
  }) {
    const { repoOptions, validateOptions = {}, cliOptions = [] } = params || {};
    const options = await getOptions({
      argv: ['node', 'beachball', ...cliOptions],
      cwd: '',
      env: {},
      testRepoOptions: { branch: defaultRemoteBranchName, registry: 'https://fake', ...repoOptions },
    });
    return validate(options, validateOptions);
  }

  function setMockPackageInfos(packageInfos: PartialPackageInfos) {
    mockGetRawPackageInfos.mockReturnValue(
      Object.entries(packageInfos).map(([name, pkg]) => ({
        name,
        version: '1.0.0',
        packageJsonPath: `packages/${name}/package.json`,
        ...pkg,
      }))
    );
  }

  beforeEach(() => {
    mockWsTools.getUntrackedChanges.mockReturnValue([]);
    mockGetRawPackageInfos.mockReturnValue([]);
    mockGetMigrationIssues.mockReturnValue({ updates: [], warnings: [] });
    mockReadChangeFiles.mockReturnValue([]);
    mockGetChangedPackages.mockReturnValue([]);
    mockAreChangeFilesDeleted.mockReturnValue(false);
    mockGetPackagesToPublish.mockReturnValue([]);
    mockBumpInMemory.mockImplementation((options, context) => ({
      packageInfos: context.originalPackageInfos,
      calculatedChangeTypes: {},
      changeFileChangeInfos: context.changeSet,
      dependentChangedBy: {},
      modifiedPackages: new Set(),
      packageGroups: context.packageGroups,
      packageTags: {},
      scopedPackages: context.scopedPackages,
    }));
  });

  it('returns context when basic validation succeeds', async () => {
    const result = await validateWrapper();
    expect(result).toEqual({
      isChangeNeeded: false,
      context: {
        originalPackageInfos: {},
        packageGroups: {},
        scopedPackages: new Set(),
        changeSet: [],
      },
    });
    expect(logs.mocks.error).not.toHaveBeenCalled();
  });

  it('errors if migration updates are needed', async () => {
    mockGetMigrationIssues.mockReturnValue({
      updates: ['The `new` option has been removed. Please remove it from your config.'],
      warnings: [],
    });

    await expect(validateWrapper()).rejects.toThrow(BeachballError);
    expect(logs.getMockLines('error')).toMatchInlineSnapshot(`
      "ERROR: The following config updates are needed for v3:
        • The \`new\` option has been removed. Please remove it from your config."
    `);
  });

  it('does not fail on migration warnings', async () => {
    mockGetMigrationIssues.mockReturnValue({
      updates: [],
      warnings: ['Potential migration issue'],
    });

    const result = await validateWrapper();
    expect(result.isChangeNeeded).toBe(false);
    expect(logs.mocks.error).not.toHaveBeenCalled();
  });

  it('warns about untracked files', async () => {
    mockWsTools.getUntrackedChanges.mockReturnValue(['new-file.ts']);

    await validateWrapper();

    expect(logs.mocks.warn).toHaveBeenCalledWith(
      'WARN: There are untracked changes in your repository:\n  • new-file.ts'
    );
  });

  it('errors if a specified package is missing or private', async () => {
    setMockPackageInfos({ private: { private: true } });
    const cliOptions = ['--package', 'missing', '--package', 'private'];

    await expect(validateWrapper({ cliOptions })).rejects.toThrow(BeachballError);
    expect(logs.getMockLines('error')).toMatchInlineSnapshot(`
      "ERROR: Invalid package(s) specified:
        • "missing" was not found
        • "private" is marked as private"
    `);
  });

  it('errors if an invalid change type is detected in existing change file', async () => {
    mockReadChangeFiles.mockReturnValue(generateChangeSet([{ packageName: 'foo', type: 'invalid' as ChangeType }]));

    await expect(validateWrapper()).rejects.toThrow(BeachballError);
    expect(logs.mocks.error).toHaveBeenCalledWith('ERROR: Invalid change type detected in change0.json: "invalid"');
  });

  it('errors if change files are needed', async () => {
    mockGetChangedPackages.mockReturnValue(['foo']);

    await expect(validateWrapper({ validateOptions: { checkChangeNeeded: true } })).rejects.toThrow(BeachballError);
    expect(logs.mocks.error).toHaveBeenCalledWith('ERROR: Change files are needed!');
  });

  it('returns changed packages when missing change files are allowed', async () => {
    mockGetChangedPackages.mockReturnValue(['foo']);

    const result = await validateWrapper({
      validateOptions: { checkChangeNeeded: true, allowMissingChangeFiles: true },
    });
    expect(result).toMatchObject({
      isChangeNeeded: true,
      context: { changedPackages: ['foo'] },
    });
  });

  it('errors if --all is used with an unsupported command', async () => {
    await expect(validateWrapper({ cliOptions: ['publish', '--all'] })).rejects.toThrow(BeachballError);
    expect(logs.mocks.error).toHaveBeenCalledWith('ERROR: "all" option is not supported for the "publish" command');
  });

  it('errors if --package is used with an unsupported command', async () => {
    await expect(validateWrapper({ cliOptions: ['canary', '--package', 'foo'] })).rejects.toThrow(BeachballError);
    expect(logs.mocks.error).toHaveBeenCalledWith('ERROR: "package" option is not supported for the "canary" command');
  });

  it.each<[Partial<BeachballOptions>, string]>([
    [{ authType: 'invalid' as AuthType }, 'ERROR: authType "invalid" is not valid'],
    [{ dependentChangeType: 'invalid' as ChangeType }, 'ERROR: dependentChangeType "invalid" is not valid'],
    [{ type: 'invalid' as ChangeType }, 'ERROR: Change type "invalid" is not valid'],
  ] as const)('throws for invalid option %o', async (option, expectedError) => {
    await expect(validateWrapper({ repoOptions: option })).rejects.toThrow(BeachballError);
    expect(logs.mocks.error).toHaveBeenCalledWith(expectedError);
  });

  it('errors if publish token is empty', async () => {
    await expect(validateWrapper({ cliOptions: ['publish', '--token', ''] })).rejects.toThrow(BeachballError);
    expect(logs.mocks.error).toHaveBeenCalledWith(expect.stringContaining('token should not be an empty string'));
  });

  it('errors if publish token is a variable reference with token auth', async () => {
    await expect(
      validateWrapper({ cliOptions: ['publish', '--token', '$TOKEN'], repoOptions: { authType: 'authtoken' } })
    ).rejects.toThrow(BeachballError);
    expect(logs.mocks.error).toHaveBeenCalledWith(
      'ERROR: token appears to be a variable reference: "$TOKEN" -- please check your workflow configuration.'
    );
  });

  it('allows a variable reference token with password auth', async () => {
    await validateWrapper({ cliOptions: ['publish', '--token', '$PASSWORD'], repoOptions: { authType: 'password' } });
    expect(logs.mocks.error).not.toHaveBeenCalled();
  });

  it('errors on invalid changelog options', async () => {
    const repoOptions = { changelog: { groups: [{}] } } as unknown as Partial<RepoOptions>;
    await expect(validateWrapper({ repoOptions })).rejects.toThrow(BeachballError);
    expect(logs.mocks.error).toHaveBeenCalledWith(expect.stringContaining('"changelog.groups" entries must define'));
  });

  it('errors on invalid group options', async () => {
    const repoOptions = { groups: [{}] } as unknown as Partial<RepoOptions>;
    await expect(validateWrapper({ repoOptions })).rejects.toThrow(BeachballError);
    expect(logs.mocks.error).toHaveBeenCalledWith(
      expect.stringContaining('"groups" configuration entries must define')
    );
  });

  it('throws for package options that conflict with a group', async () => {
    setMockPackageInfos({ foo: { beachball: { disallowedChangeTypes: ['major'] } } });

    await expect(
      validateWrapper({ repoOptions: { groups: [{ name: 'group', include: true, disallowedChangeTypes: [] }] } })
    ).rejects.toThrow(BeachballError);
    expect(logs.mocks.error).toHaveBeenCalledWith(
      expect.stringContaining('Found package configs that define disallowedChangeTypes')
    );
  });

  it('errors if a change type is missing', async () => {
    mockReadChangeFiles.mockReturnValue(
      generateChangeSet([{ packageName: 'foo', type: undefined as unknown as ChangeType }])
    );

    await expect(validateWrapper()).rejects.toThrow(BeachballError);
    expect(logs.mocks.error).toHaveBeenCalledWith('ERROR: Change type is missing in change0.json');
  });

  it('throws for a disallowed change type', async () => {
    setMockPackageInfos({ foo: {} });
    mockReadChangeFiles.mockReturnValue(generateChangeSet([{ packageName: 'foo', type: 'major' }]));

    await expect(validateWrapper({ repoOptions: { disallowedChangeTypes: ['major'] } })).rejects.toThrow(
      BeachballError
    );
    expect(logs.mocks.error).toHaveBeenCalledWith('ERROR: Disallowed change type detected in change0.json: "major"');
  });

  it('throws for an invalid dependent change type', async () => {
    mockReadChangeFiles.mockReturnValue(
      generateChangeSet([{ packageName: 'foo', dependentChangeType: 'invalid' as ChangeType }])
    );

    await expect(validateWrapper()).rejects.toThrow(BeachballError);
    expect(logs.mocks.error).toHaveBeenCalledWith(
      'ERROR: Invalid dependentChangeType detected in change0.json: "invalid"'
    );
  });

  it('errors if change files were deleted', async () => {
    mockAreChangeFilesDeleted.mockReturnValue(true);

    await expect(
      validateWrapper({
        repoOptions: { disallowDeletedChangeFiles: true },
        validateOptions: { checkChangeNeeded: true },
      })
    ).rejects.toThrow(BeachballError);
    expect(logs.mocks.error).toHaveBeenCalledWith('ERROR: Change files must not be deleted!');
  });

  it('logs the packages needing changes', async () => {
    setMockPackageInfos({ foo: {}, bar: {}, baz: {} });
    mockGetChangedPackages.mockReturnValue(['foo', 'bar']);

    await validateWrapper({ validateOptions: { checkChangeNeeded: true, allowMissingChangeFiles: true } });

    expect(logs.mocks.log).toHaveBeenCalledWith('Found changes in the following packages:\n  • bar\n  • foo');
  });

  // --all is handled internally by getChangedPackages, which is mocked
  it('passes --all and scoped packages through to getChangedPackages', async () => {
    setMockPackageInfos({ foo: {}, bar: {}, baz: {} });
    // this would respect all and scope
    mockGetChangedPackages.mockReturnValue(['foo', 'bar']);

    const result = await validateWrapper({
      cliOptions: ['--all'],
      repoOptions: { scope: ['!packages/baz'] },
      validateOptions: { checkChangeNeeded: true, allowMissingChangeFiles: true },
    });
    expect(result.context.changedPackages?.sort()).toEqual(['bar', 'foo']);
    expect(logs.mocks.log).toHaveBeenCalledWith('Considering the following packages due to --all:\n  • bar\n  • foo');
    expect(mockGetChangedPackages).toHaveBeenCalledWith(
      expect.objectContaining({ all: true }),
      expect.anything(),
      new Set(['bar', 'foo'])
    );
  });

  // --package is handled internally by getChangedPackages, which is mocked
  it('passes --package through to getChangedPackages', async () => {
    setMockPackageInfos({ foo: {}, bar: {} });
    mockGetChangedPackages.mockReturnValue(['foo']);

    const result = await validateWrapper({
      cliOptions: ['--package', 'foo'],
      validateOptions: { checkChangeNeeded: true, allowMissingChangeFiles: true },
    });
    expect(result.context.changedPackages?.sort()).toEqual(['foo']);
    expect(logs.mocks.log).toHaveBeenCalledWith('Considering the specific --package:\n  • foo');
    expect(mockGetChangedPackages).toHaveBeenCalledWith(
      expect.objectContaining({ package: ['foo'] }),
      expect.anything(),
      expect.anything()
    );
  });

  it('returns bump info if dependency validation succeeds', async () => {
    setMockPackageInfos({ foo: {} });
    const changeSet = generateChangeSet(['foo']);
    mockReadChangeFiles.mockReturnValue(changeSet);

    const result = await validateWrapper({ validateOptions: { checkDependencies: true } });
    expect(result.context.bumpInfo).toBeTruthy();
    // just validate one property that gets passed through from mocks created above
    expect(result.context.bumpInfo?.changeFileChangeInfos).toBe(changeSet);
  });

  it('errors if dependency validation fails', async () => {
    setMockPackageInfos({ foo: { dependencies: { bar: '1.0.0' } }, bar: { private: true } });
    mockReadChangeFiles.mockReturnValue(generateChangeSet(['foo']));
    mockGetPackagesToPublish.mockReturnValue(['foo']);

    await expect(validateWrapper({ validateOptions: { checkDependencies: true } })).rejects.toThrow(BeachballError);
    expect(logs.mocks.error).toHaveBeenCalledWith(expect.stringContaining('One or more published packages depend'));
  });

  it('skips dependency validation when changes are still needed', async () => {
    mockReadChangeFiles.mockReturnValue(generateChangeSet(['foo']));
    mockGetChangedPackages.mockReturnValue(['foo']);

    await validateWrapper({
      validateOptions: { checkChangeNeeded: true, allowMissingChangeFiles: true, checkDependencies: true },
    });
    expect(mockBumpInMemory).not.toHaveBeenCalled();
  });
});
