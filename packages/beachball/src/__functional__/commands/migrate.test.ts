import { describe, expect, it, beforeAll, afterAll } from '@jest/globals';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import { RepositoryFactory } from '../../__fixtures__/repositoryFactory';
import { migrate } from '../../commands/migrate';

describe('migrate command', () => {
  const logs = initMockLogs();

  let repositoryFactory: RepositoryFactory;

  beforeAll(() => {
    repositoryFactory = new RepositoryFactory('single');
  });

  afterAll(() => {
    repositoryFactory.cleanUp();
  });

  it('logs a success message when no config updates are needed', () => {
    const repo = repositoryFactory.cloneRepository();
    migrate({ path: repo.rootPath });
    expect(logs.getMockLines('log')).toMatchInlineSnapshot(`"No config updates are needed for v3."`);
  });
});
