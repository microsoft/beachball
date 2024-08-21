import { describe, expect, it, afterAll, jest, beforeAll, afterEach } from '@jest/globals';
import { defaultBranchName } from '../__fixtures__/gitDefaults';
import { RepositoryFactory } from '../__fixtures__/repositoryFactory';
import { BeachballOptions } from '../types/BeachballOptions';
import { initMockLogs } from '../__fixtures__/mockLogs';
import { validate } from '../validation/validate';

describe('validate', () => {
  let repositoryFactory: RepositoryFactory;
  const logs = initMockLogs();
  // this is mocked in jestSetup
  const processExit = process.exit as jest.MockedFunction<typeof process.exit>;

  beforeAll(() => {
    // these tests can reuse a factory because they don't push changes
    repositoryFactory = new RepositoryFactory('monorepo');
  });

  afterEach(() => {
    processExit.mockClear();
  });

  afterAll(() => {
    repositoryFactory.cleanUp();
  });

  it('succeeds with no changes', () => {
    const repo = repositoryFactory.cloneRepository();
    repo.checkout('-b', 'test');
    const options = { path: repo.rootPath, branch: defaultBranchName } as BeachballOptions;

    const result = validate(options);
    expect(result.isChangeNeeded).toBe(false);
    expect(logs.mocks.error).not.toHaveBeenCalled();
    // the success log for the "check" command is done in the main cli file, not validate()
  });

  it('exits with error by default if change files are needed', () => {
    const repo = repositoryFactory.cloneRepository();
    repo.checkout('-b', 'test');
    repo.stageChange('packages/foo/test.js');
    const options = { path: repo.rootPath, branch: defaultBranchName } as BeachballOptions;

    expect(() => validate(options)).toThrowError(/process\.exit/);
    expect(processExit).toHaveBeenCalledWith(1);
    expect(logs.mocks.error).toHaveBeenCalledWith('ERROR: Change files are needed!');
  });

  it('returns an error if change files are needed and allowMissingChangeFiles is true', () => {
    const repo = repositoryFactory.cloneRepository();
    repo.checkout('-b', 'test');
    repo.stageChange('packages/foo/test.js');
    const options = { path: repo.rootPath, branch: defaultBranchName } as BeachballOptions;

    const result = validate(options, { allowMissingChangeFiles: true });
    expect(result.isChangeNeeded).toBe(true);
    expect(logs.mocks.error).not.toHaveBeenCalled();
  });
});
