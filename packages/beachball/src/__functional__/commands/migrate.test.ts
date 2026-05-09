import { describe, expect, it, beforeAll, afterAll } from '@jest/globals';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import { RepositoryFactory } from '../../__fixtures__/repositoryFactory';
import { migrate } from '../../commands/migrate';
import type { BeachballOptions } from '../../types/BeachballOptions';
import { getDefaultOptions } from '../../options/getDefaultOptions';
import { BeachballError } from '../../types/BeachballError';
import type { ChangelogGroupOptions } from '../../types/ChangelogOptions';

describe('migrate command', () => {
  const logs = initMockLogs();

  let repositoryFactory: RepositoryFactory;

  function migrateWrapper(options: Partial<BeachballOptions>) {
    return migrate({
      ...getDefaultOptions(),
      ...options,
    });
  }

  beforeAll(() => {
    repositoryFactory = new RepositoryFactory('single');
  });

  afterAll(() => {
    repositoryFactory.cleanUp();
  });

  it('logs a success message when no config updates are needed', () => {
    migrateWrapper({
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
    expect(logs.getMockLines('log')).toEqual('No config updates are needed for v3.');
  });

  it('logs an error for negated groups[*].exclude', () => {
    const disallowedChangeTypes = null;
    expect(() =>
      migrateWrapper({
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
      })
    ).toThrow(BeachballError);

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

  it('logs an error for changelog.groups[*].masterPackageName', () => {
    expect(() =>
      migrateWrapper({
        changelog: {
          groups: [
            { masterPackageName: 'test1', changelogPath: '', include: true } as unknown as ChangelogGroupOptions,
            { mainPackageName: 'test2', changelogPath: '', include: true },
            { masterPackageName: 'test3', changelogPath: '', include: true } as unknown as ChangelogGroupOptions,
          ],
        },
      })
    ).toThrow(BeachballError);

    expect(logs.getMockLines('error')).toMatchInlineSnapshot(`
      "The following updates are needed for v3:
        • \`changelog.groups\`
          ▪ Group for package "test1"
            ◦ Rename \`masterPackageName\` to \`mainPackageName\`
          ▪ Group for package "test3"
            ◦ Rename \`masterPackageName\` to \`mainPackageName\`"
    `);
  });

  it('logs an error for negated changelog.groups[*].exclude and masterPackageName', () => {
    expect(() =>
      migrateWrapper({
        changelog: {
          groups: [
            {
              masterPackageName: 'test',
              include: true,
              exclude: ['!packages/bar', '!packages/baz'],
              changelogPath: '',
            } as Partial<ChangelogGroupOptions> as ChangelogGroupOptions,
            {
              mainPackageName: 'test2',
              include: true,
              exclude: '!packages/foo',
              changelogPath: '',
            },
            {
              mainPackageName: 'test3',
              include: true,
              exclude: 'packages/!(bar)',
              changelogPath: '',
            },
          ],
        },
      })
    ).toThrow(BeachballError);

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
