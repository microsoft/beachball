import { describe, expect, it, beforeAll, afterAll } from '@jest/globals';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import { RepositoryFactory } from '../../__fixtures__/repositoryFactory';
import { migrate } from '../../commands/migrate';
import { BeachballError } from '../../types/BeachballError';

describe('migrate command', () => {
  const logs = initMockLogs();

  let repositoryFactory: RepositoryFactory;

  beforeAll(() => {
    repositoryFactory = new RepositoryFactory('monorepo');
  });

  afterAll(() => {
    repositoryFactory.cleanUp();
  });

  it('logs a success message when no config updates are needed', () => {
    const repo = repositoryFactory.cloneRepository();
    migrate({ path: repo.rootPath });
    expect(logs.getMockLines('log')).toMatchInlineSnapshot(`"No config updates are needed for v3."`);
  });

  it('reports packages using the removed shouldPublish option', () => {
    const repo = repositoryFactory.cloneRepository();
    repo.updateJsonFile('packages/foo/package.json', { beachball: { shouldPublish: false } });
    repo.updateJsonFile('packages/baz/package.json', { beachball: { shouldPublish: false } });

    expect(() => migrate({ path: repo.rootPath })).toThrow(BeachballError);

    const output = logs.getMockLines('log', { root: repo.rootPath });
    expect(output).toMatchInlineSnapshot(`
      "The following updates are needed for v3:
        • The following packages use \`"shouldPublish": false\`, which is no longer supported. Typically you should use \`"private": true\` instead (if this doesn't work, please open an issue with details of your scenario).
          ▪ <root>/packages/baz/package.json
          ▪ <root>/packages/foo/package.json"
    `);
  });
});
