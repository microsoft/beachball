import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import path from 'path';
import { defaultRemoteBranchName } from '../../__fixtures__/gitDefaults';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import { mockProcessExit } from '../../__fixtures__/mockProcessExit';
import { makePackageInfosByFolder, type PartialPackageInfos } from '../../__fixtures__/packageInfos';
import { getPackageGroups } from '../../monorepo/getPackageGroups';
import { getParsedOptions } from '../../options/getOptions';
import type { RepoOptions } from '../../types/BeachballOptions';

describe('getPackageGroups', () => {
  const root = path.resolve('/fake-root');
  const logs = initMockLogs();

  function getPackageGroupsWrapper(params: {
    packageFolders: PartialPackageInfos;
    repoOptions?: Partial<RepoOptions>;
  }) {
    const parsedOptions = getParsedOptions({
      cwd: root,
      argv: [],
      testRepoOptions: { branch: defaultRemoteBranchName, ...params.repoOptions },
    });
    const packageInfos = makePackageInfosByFolder({
      packages: params.packageFolders,
      repoOptions: parsedOptions.repoOptions,
      cwd: root,
    });

    return getPackageGroups(packageInfos, root, parsedOptions.options.groups);
  }

  beforeAll(() => {
    mockProcessExit(logs);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('returns empty object if no groups are defined', () => {
    const groups = getPackageGroupsWrapper({
      packageFolders: { 'packages/foo': {}, 'packages/bar': {} },
    });
    expect(groups).toEqual({});
  });

  it('returns groups based on specific folders', () => {
    const groups = getPackageGroupsWrapper({
      packageFolders: {
        'packages/pkg-1': {},
        'packages/pkg-2': {},
        'other/pkg-3': {},
        'other/pkg-4': {},
      },
      repoOptions: {
        groups: [
          { name: 'group1', include: ['packages/pkg-2', 'other/pkg-3'], disallowedChangeTypes: null },
          { name: 'group2', include: ['other/pkg-4'], disallowedChangeTypes: ['major'] },
        ],
      },
    });
    expect(groups).toEqual({
      group1: { packageNames: ['pkg-2', 'pkg-3'], disallowedChangeTypes: null },
      group2: { packageNames: ['pkg-4'], disallowedChangeTypes: ['major'] },
    });
  });

  it('handles single-level globs', () => {
    const groups = getPackageGroupsWrapper({
      packageFolders: {
        'packages/ui-pkg-1': {},
        'packages/ui-pkg-2': {},
        'packages/data-pkg-1': {},
        'other/pkg-1': {},
      },
      repoOptions: {
        groups: [
          { name: 'ui-packages', include: ['packages/ui-*'], disallowedChangeTypes: null },
          { name: 'other', include: ['other/*'], disallowedChangeTypes: ['major', 'minor'] },
        ],
      },
    });
    expect(groups).toEqual({
      'ui-packages': { packageNames: ['ui-pkg-1', 'ui-pkg-2'], disallowedChangeTypes: null },
      other: { packageNames: ['pkg-1'], disallowedChangeTypes: ['major', 'minor'] },
    });
  });

  it('handles multi-level globs', () => {
    const groups = getPackageGroupsWrapper({
      packageFolders: {
        'packages/ui/components/button': {},
        'packages/ui/components/input': {},
        'packages/ui/utils/helpers': {},
        'packages/data/models/user': {},
        'packages/data/models/product': {},
        'tools/build': {},
      },
      repoOptions: {
        groups: [{ name: 'ui', include: ['packages/ui/**/*'], disallowedChangeTypes: null }],
      },
    });
    expect(groups).toEqual({
      ui: { packageNames: ['button', 'input', 'helpers'], disallowedChangeTypes: null },
    });
  });

  it('handles multiple include patterns in a single group', () => {
    const groups = getPackageGroupsWrapper({
      packageFolders: {
        'ui/button': {},
        'ui/input': {},
        'components/dialog': {},
        'components/modal': {},
        'utils/helpers': {},
      },
      repoOptions: {
        groups: [{ name: 'frontend', include: ['ui/*', 'components/*'], disallowedChangeTypes: ['major'] }],
      },
    });
    expect(groups).toEqual({
      frontend: { packageNames: ['button', 'input', 'dialog', 'modal'], disallowedChangeTypes: ['major'] },
    });
  });

  it('handles specific exclude patterns', () => {
    const groups = getPackageGroupsWrapper({
      packageFolders: {
        'packages/pkg-1': {},
        'packages/pkg-2': {},
        'packages/pkg-3': {},
        'packages/internal': {},
      },
      repoOptions: {
        groups: [
          { name: 'group', include: ['packages/*'], exclude: ['!packages/internal'], disallowedChangeTypes: null },
        ],
      },
    });
    expect(groups).toEqual({
      group: { packageNames: ['pkg-1', 'pkg-2', 'pkg-3'], disallowedChangeTypes: null },
    });
  });

  it('handles glob exclude patterns', () => {
    const groups = getPackageGroupsWrapper({
      packageFolders: {
        'packages/core/api': {},
        'packages/core/utils': {},
        'packages/plugins/plugin-a': {},
        'packages/plugins/plugin-b': {},
      },
      repoOptions: {
        groups: [
          {
            name: 'group1',
            include: ['packages/**/*'],
            exclude: ['!packages/core/*'],
            disallowedChangeTypes: null,
          },
        ],
      },
    });
    expect(groups).toEqual({
      group1: { packageNames: ['plugin-a', 'plugin-b'], disallowedChangeTypes: null },
    });
  });

  it('exits with error if package belongs to multiple groups', () => {
    expect(() =>
      getPackageGroupsWrapper({
        packageFolders: {
          'packages/pkg-1': {},
          'packages/pkg-2': {},
          'packages/shared': {},
        },
        repoOptions: {
          groups: [
            { name: 'group1', include: ['packages/*'], disallowedChangeTypes: null },
            { name: 'group2', include: ['packages/shared'], disallowedChangeTypes: ['major'] },
          ],
        },
      })
    ).toThrow('process.exit(1) called');

    expect(logs.getMockLines('error')).toMatchInlineSnapshot(`
      "ERROR: Found package(s) belonging to multiple groups:
        • shared: group1, group2"
    `);
  });

  it('omits empty groups', () => {
    const groups = getPackageGroupsWrapper({
      packageFolders: {
        'packages/pkg-1': {},
        'packages/pkg-2': {},
      },
      repoOptions: {
        groups: [{ name: 'empty-group', include: ['nonexistent/*'], disallowedChangeTypes: null }],
      },
    });
    expect(groups).toEqual({});
  });
});
