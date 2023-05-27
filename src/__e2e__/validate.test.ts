import { describe, expect, it, afterEach, jest } from '@jest/globals';
import { defaultBranchName } from '../__fixtures__/gitDefaults';
import { RepositoryFactory } from '../__fixtures__/repositoryFactory';
import { BeachballOptions } from '../types/BeachballOptions';
import { initMockLogs } from '../__fixtures__/mockLogs';
import { validate } from '../validation/validate';

describe('validate', () => {
  let repositoryFactory: RepositoryFactory | undefined;
  const logs = initMockLogs();
  // this is mocked in jestSetup
  const processExit = process.exit as jest.MockedFunction<typeof process.exit>;
  const processExitImpl = processExit.getMockImplementation()!;

  afterEach(() => {
    repositoryFactory?.cleanUp();
    repositoryFactory = undefined;
    processExit.mockImplementation(processExitImpl);
  });

  // Some super basic tests for now to ensure that validate() doesn't get blatantly broken again
  it('succeeds in a basic scenario', () => {
    repositoryFactory = new RepositoryFactory('monorepo');
    const repo = repositoryFactory.cloneRepository();
    repo.checkout('-b', 'test');
    const options = { path: repo.rootPath, branch: defaultBranchName } as BeachballOptions;
    const result = validate(options);
    expect(result.isChangeNeeded).toBe(false);
    expect(logs.mocks.error).not.toHaveBeenCalled();
    // the success log for the "change" command is done in the main cli file, not validate()
  });

  it('fails if change files are needed', () => {
    // this calls process.exit on failure, so mock it
    processExit.mockImplementation((() => {
      /*no-op*/
    }) as any);

    repositoryFactory = new RepositoryFactory('monorepo');
    const repo = repositoryFactory.cloneRepository();
    repo.checkout('-b', 'test');
    repo.stageChange('packages/foo/test.js');
    const options = { path: repo.rootPath, branch: defaultBranchName } as BeachballOptions;
    const result = validate(options);
    expect(result.isChangeNeeded).toBe(true);
    expect(logs.mocks.error).toHaveBeenCalledWith('ERROR: Change files are needed!');
  });
});
