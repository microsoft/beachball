import { describe, expect, it, afterEach, jest } from '@jest/globals';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import { migrate } from '../../commands/migrate';
import { getOptions as _getOptions } from '../../options/getOptions';
import type { RepoOptions } from '../../types/BeachballOptions';
import { removeTempDir } from '../../__fixtures__/tmpdir';
import { createTestFileStructureType, updateJsonFile } from '../../__fixtures__/createTestFileStructure';
import fs from 'fs';
import { BeachballError } from '../../types/BeachballError';
import path from 'path';
import type { ChangelogGroupOptions } from '../../types/ChangelogOptions';

jest.mock('workspace-tools', () => ({
  ...jest.requireActual<typeof import('workspace-tools')>('workspace-tools'),
  // not currently used (can add realistic mock if needed)
  resolveRemoteAndBranch: jest.fn(() => ({ remote: 'origin', remoteBranch: 'main' })),
}));

describe('migrate command', () => {
  const logs = initMockLogs();
  let tempRoot = '';

  function getOptions(repoOptions?: Partial<RepoOptions>) {
    return _getOptions({ argv: [], env: {}, cwd: tempRoot, testRepoOptions: repoOptions });
  }

  afterEach(() => {
    tempRoot && removeTempDir(tempRoot);
    tempRoot = '';
  });

  it('logs a success message when no config updates are needed', () => {
    tempRoot = createTestFileStructureType('monorepo', {
      groups: [{ name: 'test', include: 'packages/test', exclude: ['packages/foo'], disallowedChangeTypes: null }],
      changelog: {
        groups: [
          {
            mainPackageName: 'test',
            include: ['packages/test'],
            exclude: ['packages/bar'],
            changelogPath: 'packages/test',
          },
        ],
      },
    });
    // a changelog md file is okay
    fs.writeFileSync(path.join(tempRoot, 'packages/foo/CHANGELOG.md'), '');

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
      [error]   • Found CHANGELOG.json files. In v3, CHANGELOG.json generation is disabled by default, since most repos don't use them (CHANGELOG.md is still generated).
          ▪ If you DO want CHANGELOG.json files, set \`generateChangelog: true\` in your beachball config
          ▪ If you are NOT using CHANGELOG.json, delete these files:
            ◦ <root>/packages/baz/CHANGELOG.json
            ◦ <root>/packages/foo/CHANGELOG.json"
    `);
  });

  it('errors when groups have CHANGELOG.json files and generateChangelog is unset', () => {
    tempRoot = createTestFileStructureType('monorepo');
    fs.mkdirSync(path.join(tempRoot, 'changelogs'));
    fs.writeFileSync(path.join(tempRoot, 'changelogs/CHANGELOG.json'), '{}');
    const options = getOptions({
      changelog: { groups: [{ changelogPath: 'changelogs', include: true, mainPackageName: 'foo' }] },
    });

    expect(() => migrate(options)).toThrow(BeachballError);

    const output = logs.getMockLines('all', { root: tempRoot });
    expect(output).toMatchInlineSnapshot(`
      "[error] The following updates are needed for v3:
      [error]   • Found CHANGELOG.json files. In v3, CHANGELOG.json generation is disabled by default, since most repos don't use them (CHANGELOG.md is still generated).
          ▪ If you DO want CHANGELOG.json files, set \`generateChangelog: true\` in your beachball config
          ▪ If you are NOT using CHANGELOG.json, delete these files:
            ◦ <root>/changelogs/CHANGELOG.json"
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

  it('errors on negated groups[*].exclude', () => {
    const disallowedChangeTypes = null;
    tempRoot = createTestFileStructureType('monorepo', {
      groups: [
        // the group globs here don't need to make sense; just verify it only checks ! at beginning
        { name: 'ok', include: true, exclude: 'packages/!(bar)', disallowedChangeTypes },
        { name: 'badstring', include: true, exclude: '!packages/foo', disallowedChangeTypes },
        {
          name: 'badarray',
          include: true,
          exclude: ['packages/bar', '!packages/foo', '!packages/baz'],
          disallowedChangeTypes,
        },
      ],
    });
    expect(() => migrate(getOptions())).toThrow(BeachballError);

    expect(logs.getMockLines('error')).toMatchInlineSnapshot(`
      "The following updates are needed for v3:
        • \`groups\`
          ▪ Group "badstring"
            ◦ Remove the leading "!" from these \`exclude\` patterns:
              ▫ !packages/foo
          ▪ Group "badarray"
            ◦ Remove the leading "!" from these \`exclude\` patterns:
              ▫ !packages/foo
              ▫ !packages/baz"
    `);
  });

  it('errors on changelog.groups[*].masterPackageName', () => {
    tempRoot = createTestFileStructureType('monorepo', {
      changelog: {
        groups: [
          { masterPackageName: 'test1', changelogPath: '', include: true } as unknown as ChangelogGroupOptions,
          { mainPackageName: 'test2', changelogPath: '', include: true },
          { masterPackageName: 'test3', changelogPath: '', include: true } as unknown as ChangelogGroupOptions,
        ],
      },
    });
    expect(() => migrate(getOptions())).toThrow(BeachballError);

    expect(logs.getMockLines('error')).toMatchInlineSnapshot(`
      "The following updates are needed for v3:
        • \`changelog.groups\`
          ▪ Group for package "test1"
            ◦ Rename \`masterPackageName\` to \`mainPackageName\`
          ▪ Group for package "test3"
            ◦ Rename \`masterPackageName\` to \`mainPackageName\`"
    `);
  });

  it('errors on negated changelog.groups[*].exclude and masterPackageName', () => {
    tempRoot = createTestFileStructureType('monorepo', {
      changelog: {
        groups: [
          {
            masterPackageName: 'test',
            include: true,
            exclude: ['!packages/bar', '!packages/baz'],
            changelogPath: '',
          } as Partial<ChangelogGroupOptions> as ChangelogGroupOptions,
          { mainPackageName: 'test2', include: true, exclude: '!packages/foo', changelogPath: '' },
          { mainPackageName: 'test3', include: true, exclude: 'packages/!(bar)', changelogPath: '' },
        ],
      },
    });
    expect(() => migrate(getOptions())).toThrow(BeachballError);

    expect(logs.getMockLines('error')).toMatchInlineSnapshot(`
      "The following updates are needed for v3:
        • \`changelog.groups\`
          ▪ Group for package "test"
            ◦ Rename \`masterPackageName\` to \`mainPackageName\`
            ◦ Remove the leading "!" from these \`exclude\` patterns:
              ▫ !packages/bar
              ▫ !packages/baz
          ▪ Group for package "test2"
            ◦ Remove the leading "!" from these \`exclude\` patterns:
              ▫ !packages/foo"
    `);
  });
});
