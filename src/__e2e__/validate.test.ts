import { describe, expect, it, afterAll, jest, beforeAll, afterEach } from '@jest/globals';
import { defaultBranchName } from '../__fixtures__/gitDefaults';
import { RepositoryFactory } from '../__fixtures__/repositoryFactory';
import { BeachballOptions } from '../types/BeachballOptions';
import { initMockLogs } from '../__fixtures__/mockLogs';
import { validate } from '../validation/validate';
import type { Repository } from '../__fixtures__/repository';
import { getDefaultOptions } from '../options/getDefaultOptions';

describe('validate', () => {
  let repositoryFactory: RepositoryFactory;
  let repo: Repository | undefined;
  const logs = initMockLogs();
  // this is mocked in jestSetup
  const processExit = process.exit as jest.MockedFunction<typeof process.exit>;

  function getOptions(): BeachballOptions {
    return {
      ...getDefaultOptions(),
      // change to ?. if a future test uses a non-standard repo
      path: repo!.rootPath,
      branch: defaultBranchName,
    };
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

    const result = validate(getOptions());

    expect(result.isChangeNeeded).toBe(false);
    expect(logs.mocks.error).not.toHaveBeenCalled();
    // the success log for the "check" command is done in the main cli file, not validate()
  });

  it('exits with error by default if change files are needed', () => {
    repo = repositoryFactory.cloneRepository();
    repo.checkout('-b', 'test');
    repo.stageChange('packages/foo/test.js');

    expect(() => validate(getOptions())).toThrowError(/process\.exit/);
    expect(processExit).toHaveBeenCalledWith(1);
    expect(logs.mocks.error).toHaveBeenCalledWith('ERROR: Change files are needed!');
  });

  it('returns an error if change files are needed and allowMissingChangeFiles is true', () => {
    repo = repositoryFactory.cloneRepository();
    repo.checkout('-b', 'test');
    repo.stageChange('packages/foo/test.js');

    const result = validate(getOptions(), { allowMissingChangeFiles: true });
    expect(result.isChangeNeeded).toBe(true);
    expect(logs.mocks.error).not.toHaveBeenCalled();
  });
});
