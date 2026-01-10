import { describe, expect, it, afterAll, beforeAll, afterEach } from '@jest/globals';
import { defaultRemoteBranchName } from '../__fixtures__/gitDefaults';
import { RepositoryFactory } from '../__fixtures__/repositoryFactory';
import { initMockLogs } from '../__fixtures__/mockLogs';
import { validate, type ValidateOptions } from '../validation/validate';
import type { Repository } from '../__fixtures__/repository';
import { getParsedOptions } from '../options/getOptions';
import { mockProcessExit } from '../__fixtures__/mockProcessExit';

describe('validate', () => {
  let repositoryFactory: RepositoryFactory;
  let repo: Repository | undefined;
  const logs = initMockLogs();
  const processExit = mockProcessExit(logs);

  function validateWrapper(validateOptions?: ValidateOptions) {
    const parsedOptions = getParsedOptions({
      cwd: repo!.rootPath,
      argv: [],
      testRepoOptions: {
        branch: defaultRemoteBranchName,
      },
    });
    return validate(parsedOptions, validateOptions || {});
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

    const result = validateWrapper({ checkChangeNeeded: true });

    expect(result.isChangeNeeded).toBe(false);
    expect(logs.mocks.error).not.toHaveBeenCalled();
    // the success log for the "check" command is done in the main cli file, not validate()
  });

  it('exits with error by default if change files are needed', () => {
    repo = repositoryFactory.cloneRepository();
    repo.checkout('-b', 'test');
    repo.stageChange('packages/foo/test.js');

    expect(() => validateWrapper({ checkChangeNeeded: true })).toThrow(/process\.exit/);
    expect(processExit).toHaveBeenCalledWith(1);
    expect(logs.mocks.error).toHaveBeenCalledWith('ERROR: Change files are needed!');
  });

  it('returns and does not log an error if change files are needed and allowMissingChangeFiles is true', () => {
    repo = repositoryFactory.cloneRepository();
    repo.checkout('-b', 'test');
    repo.stageChange('packages/foo/test.js');

    const result = validateWrapper({ checkChangeNeeded: true, allowMissingChangeFiles: true });
    expect(result.isChangeNeeded).toBe(true);
    expect(logs.mocks.error).not.toHaveBeenCalled();
  });
});
