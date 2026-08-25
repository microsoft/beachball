import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as wsTools from 'workspace-tools';
import { generateChangeSet } from '../../__fixtures__/changeFiles';
import { makePackageInfos, type PartialPackageInfos } from '../../__fixtures__/packageInfos';
import { bumpInMemory } from '../../bump/bumpInMemory';
import { getChangedPackages } from '../../changefile/getChangedPackages';
import { readChangeFiles } from '../../changefile/readChangeFiles';
import { getPackagesToPublish } from '../../publish/getPackagesToPublish';
import { BeachballError } from '../../types/BeachballError';
import type { RepoOptions } from '../../types/BeachballOptions';
import type { ChangeType } from '../../types/ChangeInfo';
import { areChangeFilesDeleted } from '../../validation/areChangeFilesDeleted';
import { validate, type ValidateOptions } from '../../validation/validate';
import type { AuthType } from '../../types/Auth';
import { getParsedOptions } from '../../options/getOptions';
import { defaultRemoteBranchName } from '../../__fixtures__/gitDefaults';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import { getPackageInfos } from '../../monorepo/getPackageInfos';

jest.mock('workspace-tools');
jest.mock('../../bump/bumpInMemory');
jest.mock('../../changefile/getChangedPackages');
jest.mock('../../changefile/readChangeFiles');
jest.mock('../../monorepo/getPackageInfos');
jest.mock('../../publish/getPackagesToPublish');
jest.mock('../../validation/areChangeFilesDeleted');

const mockWsTools = wsTools as jest.Mocked<typeof wsTools>;
const mockBumpInMemory = bumpInMemory as jest.MockedFunction<typeof bumpInMemory>;
const mockGetChangedPackages = getChangedPackages as jest.MockedFunction<typeof getChangedPackages>;
const mockReadChangeFiles = readChangeFiles as jest.MockedFunction<typeof readChangeFiles>;
const mockGetPackagesToPublish = getPackagesToPublish as jest.MockedFunction<typeof getPackagesToPublish>;
const mockAreChangeFilesDeleted = areChangeFilesDeleted as jest.MockedFunction<typeof areChangeFilesDeleted>;
// eslint-disable-next-line etc/no-deprecated -- wrong signature
const mockGetPackageInfos = getPackageInfos as jest.MockedFunction<typeof getPackageInfos>;

describe('validate', () => {
  const logs = initMockLogs();

  function validateWrapper(params?: {
    repoOptions?: Partial<RepoOptions>;
    validateOptions?: ValidateOptions;
    cliOptions?: string[];
  }) {
    const { repoOptions, validateOptions = {}, cliOptions = [] } = params || {};
    const options = getParsedOptions({
      argv: ['node', 'beachball', ...cliOptions],
      cwd: '',
      env: {},
      testRepoOptions: { branch: defaultRemoteBranchName, registry: 'https://fake', ...repoOptions },
    });
    return validate(options, validateOptions);
  }

  function setMockPackageInfos(packageInfos: PartialPackageInfos) {
    mockGetPackageInfos.mockReturnValue(makePackageInfos(packageInfos));
  }

  beforeEach(() => {
    mockWsTools.getUntrackedChanges.mockReturnValue([]);
    mockReadChangeFiles.mockReturnValue([]);
    mockGetChangedPackages.mockReturnValue([]);
    mockAreChangeFilesDeleted.mockReturnValue(false);
    mockGetPackagesToPublish.mockReturnValue([]);
    mockGetPackageInfos.mockReturnValue({});
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

  it('returns context when basic validation succeeds', () => {
    const packageInfos = makePackageInfos({ foo: {}, bar: {} });
    mockGetPackageInfos.mockReturnValue(packageInfos);
    const result = validateWrapper();
    expect(result).toEqual({
      isChangeNeeded: false,
      context: {
        originalPackageInfos: packageInfos,
        packageGroups: {},
        scopedPackages: new Set(['bar', 'foo']),
        changeSet: [],
      },
    });
    expect(logs.mocks.error).not.toHaveBeenCalled();
  });

  it('warns about untracked files', () => {
    mockWsTools.getUntrackedChanges.mockReturnValue(['new-file.ts']);

    validateWrapper();

    expect(logs.mocks.warn).toHaveBeenCalledWith(
      'WARN: There are untracked changes in your repository:\n  • new-file.ts'
    );
  });

  it('errors if a specified package is missing or private', () => {
    setMockPackageInfos({ private: { private: true } });
    const cliOptions = ['--package', 'missing', '--package', 'private'];

    expect(() => validateWrapper({ cliOptions })).toThrow(BeachballError);
    expect(logs.getMockLines('error')).toMatchInlineSnapshot(`
      "ERROR: Invalid package(s) specified:
        • "missing" was not found
        • "private" is marked as private"
    `);
  });

  it('errors if an invalid change type is detected in existing change file', () => {
    mockReadChangeFiles.mockReturnValue(generateChangeSet([{ packageName: 'foo', type: 'invalid' as ChangeType }]));

    expect(() => validateWrapper()).toThrow(BeachballError);
    expect(logs.mocks.error).toHaveBeenCalledWith('ERROR: Invalid change type detected in change0.json: "invalid"');
  });

  it('allows missing dependentChangeType in change file', () => {
    const changeSet = generateChangeSet([{ packageName: 'foo', type: 'minor' }]);
    mockReadChangeFiles.mockReturnValue(changeSet);

    const result = validateWrapper();
    expect(result.context.changeSet).toEqual(changeSet);
    expect(logs.mocks.error).not.toHaveBeenCalled();
  });

  it('errors if change files are needed', () => {
    mockGetChangedPackages.mockReturnValue(['foo']);

    expect(() => validateWrapper({ validateOptions: { checkChangeNeeded: true } })).toThrow(BeachballError);
    expect(logs.mocks.error).toHaveBeenCalledWith('ERROR: Change files are needed!');
  });

  it('returns changed packages when missing change files are allowed', () => {
    mockGetChangedPackages.mockReturnValue(['foo']);

    const result = validateWrapper({
      validateOptions: { checkChangeNeeded: true, allowMissingChangeFiles: true },
    });
    expect(result).toMatchObject({
      isChangeNeeded: true,
      context: { changedPackages: ['foo'] },
    });
  });

  it('errors on invalid authType', () => {
    expect(() => validateWrapper({ repoOptions: { authType: 'invalid' as AuthType } })).toThrow(BeachballError);
    expect(logs.mocks.error).toHaveBeenCalledWith('ERROR: authType "invalid" is not valid');
  });

  it('errors on invalid dependentChangeType', () => {
    expect(() => validateWrapper({ cliOptions: ['--dependentChangeType', 'invalid'] })).toThrow(BeachballError);
    expect(logs.mocks.error).toHaveBeenCalledWith('ERROR: dependentChangeType "invalid" is not valid');
  });

  it('errors on invalid change type', () => {
    expect(() => validateWrapper({ cliOptions: ['--type', 'invalid'] })).toThrow(BeachballError);
    expect(logs.mocks.error).toHaveBeenCalledWith('ERROR: Change type "invalid" is not valid');
  });

  it('errors if publish token is empty', () => {
    expect(() => validateWrapper({ cliOptions: ['publish', '--token', ''] })).toThrow(BeachballError);
    expect(logs.mocks.error).toHaveBeenCalledWith(expect.stringContaining('token should not be an empty string'));
  });

  it('errors if publish token is a variable reference with token auth', () => {
    expect(() =>
      validateWrapper({ cliOptions: ['publish', '--token', '$TOKEN'], repoOptions: { authType: 'authtoken' } })
    ).toThrow(BeachballError);
    expect(logs.mocks.error).toHaveBeenCalledWith(
      'ERROR: token appears to be a variable reference: "$TOKEN" -- please check your workflow configuration.'
    );
  });

  it('allows a variable reference token with password auth', () => {
    validateWrapper({ cliOptions: ['publish', '--token', '$PASSWORD'], repoOptions: { authType: 'password' } });
    expect(logs.mocks.error).not.toHaveBeenCalled();
  });

  it('errors on invalid changelog options', () => {
    const repoOptions = { changelog: { groups: [{}] } } as unknown as Partial<RepoOptions>;
    expect(() => validateWrapper({ repoOptions })).toThrow(BeachballError);
    expect(logs.mocks.error).toHaveBeenCalledWith(expect.stringContaining('"changelog.groups" entries must define'));
  });

  it('errors on invalid group options', () => {
    const repoOptions = { groups: [{}] } as unknown as Partial<RepoOptions>;
    expect(() => validateWrapper({ repoOptions })).toThrow(BeachballError);
    expect(logs.mocks.error).toHaveBeenCalledWith(
      expect.stringContaining('"groups" configuration entries must define')
    );
  });

  it('throws for package options that conflict with a group', () => {
    setMockPackageInfos({ foo: { beachball: { disallowedChangeTypes: ['major'] } } });

    expect(() =>
      validateWrapper({ repoOptions: { groups: [{ name: 'group', include: true, disallowedChangeTypes: [] }] } })
    ).toThrow(BeachballError);
    expect(logs.mocks.error).toHaveBeenCalledWith(
      expect.stringContaining('Found package configs that define disallowedChangeTypes')
    );
  });

  it('errors if a change type is missing', () => {
    mockReadChangeFiles.mockReturnValue(
      generateChangeSet([{ packageName: 'foo', type: undefined as unknown as ChangeType }])
    );

    expect(() => validateWrapper()).toThrow(BeachballError);
    expect(logs.mocks.error).toHaveBeenCalledWith('ERROR: Change type is missing in change0.json');
  });

  it('throws for a disallowed change type', () => {
    setMockPackageInfos({ foo: {} });
    mockReadChangeFiles.mockReturnValue(generateChangeSet([{ packageName: 'foo', type: 'major' }]));

    expect(() => validateWrapper({ repoOptions: { disallowedChangeTypes: ['major'] } })).toThrow(BeachballError);
    expect(logs.mocks.error).toHaveBeenCalledWith('ERROR: Disallowed change type detected in change0.json: "major"');
  });

  it('throws for an invalid dependent change type', () => {
    mockReadChangeFiles.mockReturnValue(
      generateChangeSet([{ packageName: 'foo', dependentChangeType: 'invalid' as ChangeType }])
    );

    expect(() => validateWrapper()).toThrow(BeachballError);
    expect(logs.mocks.error).toHaveBeenCalledWith(
      'ERROR: Invalid dependentChangeType detected in change0.json: "invalid"'
    );
  });

  it('errors if change files were deleted', () => {
    mockAreChangeFilesDeleted.mockReturnValue(true);

    expect(() =>
      validateWrapper({
        repoOptions: { disallowDeletedChangeFiles: true },
        validateOptions: { checkChangeNeeded: true },
      })
    ).toThrow(BeachballError);
    expect(logs.mocks.error).toHaveBeenCalledWith('ERROR: Change files must not be deleted!');
  });

  it('logs the packages needing changes', () => {
    setMockPackageInfos({ foo: {}, bar: {}, baz: {} });
    mockGetChangedPackages.mockReturnValue(['foo', 'bar']);

    validateWrapper({ validateOptions: { checkChangeNeeded: true, allowMissingChangeFiles: true } });

    expect(logs.mocks.log).toHaveBeenCalledWith('Found changes in the following packages:\n  • bar\n  • foo');
  });

  // --all is handled internally by getChangedPackages, which is mocked
  it('passes --all and scoped packages through to getChangedPackages', () => {
    setMockPackageInfos({ foo: {}, bar: {}, baz: {} });
    // this would respect all and scope
    mockGetChangedPackages.mockReturnValue(['foo', 'bar']);

    const result = validateWrapper({
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
  it('passes --package through to getChangedPackages', () => {
    setMockPackageInfos({ foo: {}, bar: {} });
    mockGetChangedPackages.mockReturnValue(['foo']);

    const result = validateWrapper({
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

  it('returns bump info if dependency validation succeeds', () => {
    setMockPackageInfos({ foo: {} });
    const changeSet = generateChangeSet(['foo']);
    mockReadChangeFiles.mockReturnValue(changeSet);

    const result = validateWrapper({ validateOptions: { checkDependencies: true } });
    expect(result.context.bumpInfo).toBeTruthy();
    // just validate one property that gets passed through from mocks created above
    expect(result.context.bumpInfo?.changeFileChangeInfos).toBe(changeSet);
  });

  it('errors if dependency validation fails', () => {
    setMockPackageInfos({ foo: { dependencies: { bar: '1.0.0' } }, bar: { private: true } });
    mockReadChangeFiles.mockReturnValue(generateChangeSet(['foo']));
    mockGetPackagesToPublish.mockReturnValue(['foo']);

    expect(() => validateWrapper({ validateOptions: { checkDependencies: true } })).toThrow(BeachballError);
    expect(logs.mocks.error).toHaveBeenCalledWith(expect.stringContaining('One or more published packages depend'));
  });

  it('skips dependency validation when changes are still needed', () => {
    mockReadChangeFiles.mockReturnValue(generateChangeSet(['foo']));
    mockGetChangedPackages.mockReturnValue(['foo']);

    validateWrapper({
      validateOptions: { checkChangeNeeded: true, allowMissingChangeFiles: true, checkDependencies: true },
    });
    expect(mockBumpInMemory).not.toHaveBeenCalled();
  });
});
