import { describe, expect, it, afterAll, type jest, beforeAll, afterEach } from '@jest/globals';
import { defaultRemoteBranchName } from '../__fixtures__/gitDefaults';
import { RepositoryFactory } from '../__fixtures__/repositoryFactory';
import { initMockLogs } from '../__fixtures__/mockLogs';
import { validate } from '../validation/validate';
import type { Repository } from '../__fixtures__/repository';
import { getParsedOptions } from '../options/getOptions';
import { getPackageInfos } from '../monorepo/getPackageInfos';

describe('validate', () => {
  let repositoryFactory: RepositoryFactory;
  let repo: Repository | undefined;
  const logs = initMockLogs();
  // this is mocked in jestSetup
  const processExit = process.exit as jest.MockedFunction<typeof process.exit>;

  function getOptionsAndPackages() {
    const parsedOptions = getParsedOptions({
      cwd: repo!.rootPath,
      argv: [],
      testRepoOptions: {
        branch: defaultRemoteBranchName,
      },
    });
    const packageInfos = getPackageInfos(parsedOptions);
    return { packageInfos, options: parsedOptions.options, parsedOptions };
  }

  beforeAll(() => {
    // these tests can reuse a factory because they don't push changes
    repositoryFactory = new RepositoryFactory('monorepo');
  });

  afterEach(() => {
    processExit.mockClear();
    repo = undefined;
  });

  afterAll(() => {
    repositoryFactory.cleanUp();
  });

  it('succeeds with no changes', () => {
    repo = repositoryFactory.cloneRepository();
    repo.checkout('-b', 'test');

    const { options, packageInfos } = getOptionsAndPackages();
    const result = validate(options, { checkChangeNeeded: true }, packageInfos);

    expect(result.isChangeNeeded).toBe(false);
    expect(logs.mocks.error).not.toHaveBeenCalled();
    // the success log for the "check" command is done in the main cli file, not validate()
  });

  it('exits with error by default if change files are needed', () => {
    repo = repositoryFactory.cloneRepository();
    repo.checkout('-b', 'test');
    repo.stageChange('packages/foo/test.js');

    const { options, packageInfos } = getOptionsAndPackages();
    expect(() => validate(options, { checkChangeNeeded: true }, packageInfos)).toThrowError(/process\.exit/);
    expect(processExit).toHaveBeenCalledWith(1);
    expect(logs.mocks.error).toHaveBeenCalledWith('ERROR: Change files are needed!');
  });

  it('returns and does not log an error if change files are needed and allowMissingChangeFiles is true', () => {
    repo = repositoryFactory.cloneRepository();
    repo.checkout('-b', 'test');
    repo.stageChange('packages/foo/test.js');

    const { options, packageInfos } = getOptionsAndPackages();
    const result = validate(options, { checkChangeNeeded: true, allowMissingChangeFiles: true }, packageInfos);
    expect(result.isChangeNeeded).toBe(true);
    expect(logs.mocks.error).not.toHaveBeenCalled();
  });
});
