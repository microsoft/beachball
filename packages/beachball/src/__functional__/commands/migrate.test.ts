import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { initMockLogs, removeTempDir, updateJson } from '@microsoft/beachball-test-utilities';
import fs from 'node:fs';
import path from 'node:path';
import { createTestFileStructureType } from '../../__fixtures__/createTestFileStructureType';
import { migrate } from '../../commands/migrate';
import { getOptions as _getOptions } from '../../options/getOptions';
import { BeachballError } from '../../types/BeachballError';
import type { HooksOptions, RepoOptions } from '../../types/BeachballOptions';
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

  it('logs a success message when no config updates are needed', async () => {
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

    migrate(await getOptions());
    expect(logs.getMockLines('log')).toEqual('No config updates are needed for v3.');
  });

  it('errors on "new" option', async () => {
    tempRoot = createTestFileStructureType('single');
    const options = await getOptions({ new: true } as unknown as RepoOptions);
    expect(() => migrate(options)).toThrow(BeachballError);
    expect(logs.getMockLines('all')).toMatchInlineSnapshot(`
      "[error] The following updates are needed for v3:
      [error]   • The \`new\` option has been removed. Please remove it from your config."
    `);
  });

  it('errors on "packStyle" option', async () => {
    tempRoot = createTestFileStructureType('single');
    const options = await getOptions({ packStyle: 'pack' } as unknown as RepoOptions);
    expect(() => migrate(options)).toThrow(BeachballError);
    expect(logs.getMockLines('all')).toMatchInlineSnapshot(`
      "[error] The following updates are needed for v3:
      [error]   • The \`packStyle\` option has been removed (packing always uses the layered style now). Please remove it from your config."
    `);
  });

  it('errors on "hooks.prebump" with more than 3 params', async () => {
    tempRoot = createTestFileStructureType('single');
    const fn: HooksOptions['postbump'] = (_pth, _name, _version, _pkgInfos) => {};
    const options = await getOptions({
      hooks: { prebump: fn as HooksOptions['prebump'] },
    });

    expect(() => migrate(options)).toThrow(BeachballError);
    expect(logs.getMockLines('all')).toMatchInlineSnapshot(`
      "[error] The following updates are needed for v3:
      [error]   • \`hooks.prebump\` no longer receives \`packageInfos\`. See migration guide."
    `);
  });

  it('warns on public packages using shouldPublish option', async () => {
    tempRoot = createTestFileStructureType('monorepo');
    updateJson(path.join(tempRoot, 'packages/foo/package.json'), { beachball: { shouldPublish: false } });
    updateJson(path.join(tempRoot, 'packages/baz/package.json'), { beachball: { shouldPublish: false } });

    migrate(await getOptions());

    const output = logs.getMockLines('all', { root: tempRoot });
    expect(output).toMatchInlineSnapshot(`
      "[warn] The following warnings were found for your config:
      [warn]   • Found non-private packages using \`"shouldPublish": false\`. The behavior of this setting has changed--please see the v3 migration guide for details and verify it still works for your scenario.
          ▪ <root>/packages/baz/package.json
          ▪ <root>/packages/foo/package.json"
    `);
  });

  it('errors when CHANGELOG.json files exist and generateChangelog is unset', async () => {
    tempRoot = createTestFileStructureType('monorepo');
    fs.writeFileSync(path.join(tempRoot, 'packages/foo/CHANGELOG.json'), '{}');
    fs.writeFileSync(path.join(tempRoot, 'packages/baz/CHANGELOG.json'), '{}');
    const options = await getOptions();

    expect(() => migrate(options)).toThrow(BeachballError);

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

  it('errors when groups have CHANGELOG.json files and generateChangelog is unset', async () => {
    tempRoot = createTestFileStructureType('monorepo');
    fs.mkdirSync(path.join(tempRoot, 'changelogs'));
    fs.writeFileSync(path.join(tempRoot, 'changelogs/CHANGELOG.json'), '{}');
    const options = await getOptions({
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

  it('does not error on CHANGELOG.json files when generateChangelog is explicitly set', async () => {
    tempRoot = createTestFileStructureType('monorepo');
    fs.writeFileSync(path.join(tempRoot, 'packages/foo/CHANGELOG.json'), '{}');

    migrate(await getOptions({ generateChangelog: true }));

    expect(logs.getMockLines('all')).toEqual('[log] No config updates are needed for v3.');
  });

  it('errors on private packages using shouldPublish option', async () => {
    tempRoot = createTestFileStructureType('monorepo');
    updateJson(path.join(tempRoot, 'packages/foo/package.json'), {
      private: true,
      beachball: { shouldPublish: false },
    });
    updateJson(path.join(tempRoot, 'packages/baz/package.json'), {
      private: true,
      beachball: { shouldPublish: false },
    });
    const options = await getOptions();

    expect(() => migrate(options)).toThrow(BeachballError);

    const output = logs.getMockLines('all', { root: tempRoot });
    expect(output).toMatchInlineSnapshot(`
      "[error] The following updates are needed for v3:
      [error]   • Found private packages using \`"shouldPublish": false\`. This setting does nothing with private packages and should be removed.
          ▪ <root>/packages/baz/package.json
          ▪ <root>/packages/foo/package.json"
    `);
  });

  it('errors on negated groups[*].exclude', async () => {
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
    const options = await getOptions();
    expect(() => migrate(options)).toThrow(BeachballError);

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

  it('errors on changelog.groups[*].masterPackageName', async () => {
    tempRoot = createTestFileStructureType('monorepo', {
      changelog: {
        groups: [
          { masterPackageName: 'test1', changelogPath: '', include: true } as unknown as ChangelogGroupOptions,
          { mainPackageName: 'test2', changelogPath: '', include: true },
          { masterPackageName: 'test3', changelogPath: '', include: true } as unknown as ChangelogGroupOptions,
        ],
      },
    });
    const options = await getOptions();
    expect(() => migrate(options)).toThrow(BeachballError);

    expect(logs.getMockLines('error')).toMatchInlineSnapshot(`
      "The following updates are needed for v3:
        • \`changelog.groups\`
          ▪ Group for package "test1"
            ◦ Rename \`masterPackageName\` to \`mainPackageName\`
          ▪ Group for package "test3"
            ◦ Rename \`masterPackageName\` to \`mainPackageName\`"
    `);
  });

  it('errors on negated changelog.groups[*].exclude and masterPackageName', async () => {
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
    const options = await getOptions();
    expect(() => migrate(options)).toThrow(BeachballError);

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
