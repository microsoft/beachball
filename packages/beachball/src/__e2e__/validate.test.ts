import { afterAll, afterEach, beforeAll, describe, expect, it } from '@jest/globals';
import { initMockLogs } from '@microsoft/beachball-test-utilities';
import { generateChangeFiles } from '../__fixtures__/changeFiles';
import { defaultRemoteBranchName } from '../__fixtures__/gitDefaults';
import type { Repository } from '../__fixtures__/repository';
import { RepositoryFactory } from '../__fixtures__/repositoryFactory';
import { getOptions } from '../options/getOptions';
import { BeachballError } from '../types/BeachballError';
import type { RepoOptions } from '../types/BeachballOptions';
import { validate, type ValidateOptions } from '../validation/validate';

describe('validate', () => {
  let repositoryFactory: RepositoryFactory;
  let repo: Repository | undefined;
  const logs = initMockLogs();

  async function validateWrapper(validateOptions?: ValidateOptions, repoOptions?: Partial<RepoOptions>) {
    const parsedOptions = await getOptions({
      cwd: repo!.rootPath,
      argv: [],
      env: {},
      testRepoOptions: {
        branch: defaultRemoteBranchName,
        ...repoOptions,
      },
    });
    return validate(parsedOptions, validateOptions || {});
  }

  beforeAll(() => {
    // these tests can reuse a factory because they don't push changes
    repositoryFactory = new RepositoryFactory('monorepo');
  });

  afterEach(() => {
    repo = undefined;
  });

  afterAll(() => {
    repositoryFactory.cleanUp();
  });

  it('succeeds with no changes', async () => {
    repo = repositoryFactory.cloneRepository();
    repo.checkout('-b', 'test');

    const result = await validateWrapper({ checkChangeNeeded: true });

    expect(result.isChangeNeeded).toBe(false);
    expect(logs.mocks.error).not.toHaveBeenCalled();
    // the success log for the "check" command is done in the main cli file, not validate()
  });

  it('exits with error by default if change files are needed', async () => {
    repo = repositoryFactory.cloneRepository();
    repo.checkout('-b', 'test');
    repo.stageChange('packages/foo/test.js');

    await expect(validateWrapper({ checkChangeNeeded: true })).rejects.toThrow(BeachballError);
    expect(logs.mocks.error).toHaveBeenCalledWith('ERROR: Change files are needed!');
  });

  it('returns and does not log an error if change files are needed and allowMissingChangeFiles is true', async () => {
    repo = repositoryFactory.cloneRepository();
    repo.checkout('-b', 'test');
    repo.stageChange('packages/foo/test.js');

    const result = await validateWrapper({ checkChangeNeeded: true, allowMissingChangeFiles: true });
    expect(result.isChangeNeeded).toBe(true);
    expect(logs.mocks.error).not.toHaveBeenCalled();
  });

  // A shouldPublish: false package depending on a private (or shouldPublish: false) package must
  // not be treated as a "published package" during dependency validation. Otherwise `check`
  // produces a false-positive error, since the dependent itself won't be published.
  it('does not report dependency errors for shouldPublish:false package depending on private package', async () => {
    repo = repositoryFactory.cloneRepository();
    repo.updateJsonFile('packages/foo/package.json', { beachball: { shouldPublish: false } });
    repo.updateJsonFile('packages/bar/package.json', { private: true });

    const parsedOptions = await getOptions({
      cwd: repo.rootPath,
      argv: [],
      env: {},
      testRepoOptions: { branch: defaultRemoteBranchName },
    });

    generateChangeFiles(['foo'], parsedOptions.options);

    const result = validate(parsedOptions, { checkChangeNeeded: true, checkDependencies: true });

    expect(result.isChangeNeeded).toBe(false);
    expect(logs.mocks.error).not.toHaveBeenCalled();
  });

  it('reports error-level migration checks', async () => {
    repo = repositoryFactory.cloneRepository();
    repo.updateJsonFile('packages/foo/package.json', { private: true, beachball: { shouldPublish: false } });

    await expect(validateWrapper()).rejects.toThrow(BeachballError);
    expect(logs.getMockLines('error', { root: repo.rootPath })).toMatchInlineSnapshot(`
      "ERROR: The following config updates are needed for v3:
        • Found private packages using \`"shouldPublish": false\`. This setting does nothing with private packages and should be removed.
          ▪ <root>/packages/foo/package.json"
    `);
  });

  it('reports malformed groups through validation instead of throwing a TypeError', async () => {
    repo = repositoryFactory.cloneRepository();
    const groups = { name: 'group', include: true } as unknown as RepoOptions['groups'];

    await expect(validateWrapper(undefined, { groups })).rejects.toThrow(BeachballError);
    expect(logs.mocks.error).toHaveBeenCalledWith(
      expect.stringContaining('Expected "groups" configuration setting to be an array')
    );
  });
});
