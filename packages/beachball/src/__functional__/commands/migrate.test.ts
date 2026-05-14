import { describe, expect, it, afterEach, jest } from '@jest/globals';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import { migrate } from '../../commands/migrate';
import { getParsedOptions } from '../../options/getOptions';
import type { RepoOptions } from '../../types/BeachballOptions';
import { removeTempDir } from '../../__fixtures__/tmpdir';
import { createTestFileStructureType } from '../../__fixtures__/createTestFileStructure';
import { BeachballError } from '../../types/BeachballError';

jest.mock('workspace-tools', () => ({
  ...jest.requireActual<typeof import('workspace-tools')>('workspace-tools'),
  getDefaultRemoteBranch: jest.fn((options: { branch?: string }) => `origin/${options.branch || 'main'}`),
}));

describe('migrate command', () => {
  const logs = initMockLogs();
  let tempRoot = '';

  function getOptions(repoOptions?: Partial<RepoOptions>) {
    return getParsedOptions({ argv: [], env: {}, cwd: tempRoot, testRepoOptions: repoOptions });
  }

  afterEach(() => {
    tempRoot && removeTempDir(tempRoot);
    tempRoot = '';
  });

  it('logs a success message when no config updates are needed', () => {
    tempRoot = createTestFileStructureType('monorepo');
    migrate(getOptions());
    expect(logs.getMockLines('log')).toEqual('No config updates are needed for v3.');
  });

  it('errors on "new" option', () => {
    tempRoot = createTestFileStructureType('single');
    expect(() => migrate(getOptions({ new: true } as unknown as RepoOptions))).toThrow(BeachballError);
    expect(logs.getMockLines('all')).toMatchInlineSnapshot(`
      "[error] The following updates are needed for v3:
      [error]   • The \`new\` option has been removed. Please remove it from your config."
    `);
  });
});
