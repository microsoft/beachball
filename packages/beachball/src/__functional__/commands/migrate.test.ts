import { describe, expect, it, afterEach, jest } from '@jest/globals';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import { migrate } from '../../commands/migrate';
import { getParsedOptions } from '../../options/getOptions';
import type { RepoOptions } from '../../types/BeachballOptions';
import { removeTempDir } from '../../__fixtures__/tmpdir';
import { createTestFileStructureType, updateJsonFile } from '../../__fixtures__/createTestFileStructure';
import fs from 'fs';
import { BeachballError } from '../../types/BeachballError';
import path from 'path';

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

  it('warns on public packages using shouldPublish option', () => {
    tempRoot = createTestFileStructureType('monorepo');
    updateJsonFile(path.join(tempRoot, 'packages/foo/package.json'), { beachball: { shouldPublish: false } });
    updateJsonFile(path.join(tempRoot, 'packages/baz/package.json'), { beachball: { shouldPublish: false } });

    migrate(getOptions());

    const output = logs.getMockLines('all', { root: tempRoot });
    expect(output).toMatchInlineSnapshot(`
      "[warn] The following warnings were found for your config:
      [warn]   • Found non-private packages using \`"shouldPublish": false\`. The behavior of this setting has changed--please see the v3 migration guide for details and verify it still works for your scenario.
          ▪ <root>/packages/baz/package.json
          ▪ <root>/packages/foo/package.json"
    `);
  });

  it('errors when CHANGELOG.json files exist and generateChangelog is unset', () => {
    tempRoot = createTestFileStructureType('monorepo');
    fs.writeFileSync(path.join(tempRoot, 'packages/foo/CHANGELOG.json'), '{}');
    fs.writeFileSync(path.join(tempRoot, 'packages/baz/CHANGELOG.json'), '{}');

    expect(() => migrate(getOptions())).toThrow(BeachballError);

    const output = logs.getMockLines('all', { root: tempRoot });
    expect(output).toMatchInlineSnapshot(`
      "[error] The following updates are needed for v3:
      [error]   • Found packages with existing CHANGELOG.json files. In v3, CHANGELOG.json generation is disabled by default, since most repos don't use them (CHANGELOG.md is still generated).
          ▪ If you DO want CHANGELOG.json files, set \`generateChangelog: true\` in your beachball config
          ▪ If you are NOT using CHANGELOG.json, delete these files:
            ◦ <root>/packages/baz/CHANGELOG.json
            ◦ <root>/packages/foo/CHANGELOG.json"
    `);
  });

  it('does not error on CHANGELOG.json files when generateChangelog is explicitly set', () => {
    tempRoot = createTestFileStructureType('monorepo');
    fs.writeFileSync(path.join(tempRoot, 'packages/foo/CHANGELOG.json'), '{}');

    migrate(getOptions({ generateChangelog: true }));

    expect(logs.getMockLines('all')).toEqual('[log] No config updates are needed for v3.');
  });

  it('errors on private packages using shouldPublish option', () => {
    tempRoot = createTestFileStructureType('monorepo');
    updateJsonFile(path.join(tempRoot, 'packages/foo/package.json'), {
      private: true,
      beachball: { shouldPublish: false },
    });
    updateJsonFile(path.join(tempRoot, 'packages/baz/package.json'), {
      private: true,
      beachball: { shouldPublish: false },
    });

    expect(() => migrate(getOptions())).toThrow(BeachballError);

    const output = logs.getMockLines('all', { root: tempRoot });
    expect(output).toMatchInlineSnapshot(`
      "[error] The following updates are needed for v3:
      [error]   • Found private packages using \`"shouldPublish": false\`. This setting does nothing with private packages and should be removed.
          ▪ <root>/packages/baz/package.json
          ▪ <root>/packages/foo/package.json"
    `);
  });
});
