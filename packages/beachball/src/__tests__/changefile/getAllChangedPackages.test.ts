import { describe, expect, it } from '@jest/globals';
import path from 'path';
import { defaultRemoteBranchName } from '../../__fixtures__/gitDefaults';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import { makePackageInfos } from '../../__fixtures__/packageInfos';
import { getAllChangedPackages } from '../../changefile/getAllChangedPackages';
import { getScopedPackages } from '../../monorepo/getScopedPackages';
import { getParsedOptions } from '../../options/getOptions';
import type { RepoOptions } from '../../types/BeachballOptions';
import type { PackageInfos } from '../../types/PackageInfo';

describe('getAllChangedPackages', () => {
  const logs = initMockLogs();
  const fakeRoot = path.resolve('/fake/root');

  const singlePackageInfo = () => makePackageInfos({ foo: { packageJsonPath: path.join(fakeRoot, 'package.json') } });
  // mirror the filesystem monorepo structure
  const monorepoPackageInfos = () =>
    makePackageInfos(
      {
        foo: {},
        bar: {},
        baz: {},
        'grouped/a': { packageJsonPath: path.join(fakeRoot, 'packages/grouped/a/package.json') },
        'grouped/b': { packageJsonPath: path.join(fakeRoot, 'packages/grouped/b/package.json') },
      },
      { path: fakeRoot }
    );

  /** Get options/context and call `getAllChangedPackages` */
  function getAllChangedPackagesWrapper(params: {
    packageInfos: PackageInfos;
    repoOptions?: Partial<RepoOptions>;
    extraArgv?: string[];
    allChangedFiles?: string[];
  }) {
    const { repoOptions, extraArgv = [], packageInfos } = params;
    const parsedOptions = getParsedOptions({
      cwd: fakeRoot,
      argv: ['node', 'beachball', 'change', ...extraArgv],
      env: {},
      testRepoOptions: {
        fetch: false,
        branch: defaultRemoteBranchName,
        ...repoOptions,
      },
    });
    const scopedPackages = getScopedPackages(parsedOptions.options, packageInfos);
    return getAllChangedPackages({
      options: parsedOptions.options,
      packageInfos,
      scopedPackages,
      allChangedFiles: new Set(params.allChangedFiles || []),
    });
  }

  it('returns empty list when no changes in single repo', () => {
    const result = getAllChangedPackagesWrapper({ packageInfos: singlePackageInfo(), extraArgv: ['--verbose'] });
    expect(result).toEqual([]);
    expect(logs.getMockLines('all')).toMatchInlineSnapshot(`"[log] Found no changed files in current branch"`);
  });

  it('returns empty list when no changes in monorepo', () => {
    const result = getAllChangedPackagesWrapper({ packageInfos: monorepoPackageInfos() });
    expect(result).toEqual([]);
  });

  it('detects changed files in single-package repo', () => {
    const result = getAllChangedPackagesWrapper({ packageInfos: singlePackageInfo(), allChangedFiles: ['myFilename'] });
    expect(result).toEqual(['foo']);
  });

  it('detects changed files in monorepo', () => {
    const result = getAllChangedPackagesWrapper({
      packageInfos: monorepoPackageInfos(),
      extraArgv: ['--verbose'],
      allChangedFiles: ['packages/foo/myFilename', 'not-package/file'],
    });
    expect(result).toEqual(['foo']);
    expect(logs.getMockLines('all')).toMatchInlineSnapshot(`
      "[log] Found 2 changed files in current branch (before filtering)
      [log]   - packages/foo/myFilename
      [log]   - ~~not-package/file~~ (not in a package)
      [log] Found 1 file in 1 package that should be published"
    `);
  });

  it('ignores CHANGELOG.* in single-package repo', () => {
    const result = getAllChangedPackagesWrapper({
      packageInfos: singlePackageInfo(),
      allChangedFiles: ['CHANGELOG.md', 'CHANGELOG.json'],
      extraArgv: ['--verbose'],
    });
    expect(result).toEqual([]);
    expect(logs.getMockLines('all')).toMatchInlineSnapshot(`
      "[log] Found 2 changed files in current branch (before filtering)
      [log]   - ~~CHANGELOG.md~~ (ignored by pattern "CHANGELOG.{md,json}")
      [log]   - ~~CHANGELOG.json~~ (ignored by pattern "CHANGELOG.{md,json}")
      [log] All files were ignored"
    `);
  });

  it('ignores CHANGELOG.* in monorepo', () => {
    const result = getAllChangedPackagesWrapper({
      packageInfos: monorepoPackageInfos(),
      allChangedFiles: ['packages/foo/CHANGELOG.md', 'packages/foo/CHANGELOG.json', 'packages/bar/foo.ts'],
      extraArgv: ['--verbose'],
    });
    expect(result).toEqual(['bar']);
    expect(logs.getMockLines('all')).toMatchInlineSnapshot(`
      "[log] Found 3 changed files in current branch (before filtering)
      [log]   - ~~packages/foo/CHANGELOG.md~~ (ignored by pattern "CHANGELOG.{md,json}")
      [log]   - ~~packages/foo/CHANGELOG.json~~ (ignored by pattern "CHANGELOG.{md,json}")
      [log]   - packages/bar/foo.ts
      [log] Found 1 file in 1 package that should be published"
    `);
  });

  // change files are outside a package in a monorepo
  it('ignores change files in single-package repo', () => {
    const result = getAllChangedPackagesWrapper({
      packageInfos: singlePackageInfo(),
      allChangedFiles: ['change/change-abc123.json', 'myFilename'],
      extraArgv: ['--verbose'],
    });
    expect(result).toEqual(['foo']);
    expect(logs.getMockLines('all')).toMatchInlineSnapshot(`
      "[log] Found 2 changed files in current branch (before filtering)
      [log]   - ~~change/change-abc123.json~~ (ignored by pattern "change/*.json")
      [log]   - myFilename
      [log] Found 1 file in 1 package that should be published"
    `);
  });

  it('respects ignorePatterns in single-package repo', () => {
    const result = getAllChangedPackagesWrapper({
      packageInfos: singlePackageInfo(),
      // change a default-ignored file too, to ensure the ignore patterns merge
      allChangedFiles: ['src/foo.test.js', 'tests/stuff.js', 'yarn.lock', 'CHANGELOG.md'],
      repoOptions: { ignorePatterns: ['**/*.test.js', 'tests/**', 'yarn.lock'] },
      extraArgv: ['--verbose'],
    });
    expect(result).toEqual([]);
    expect(logs.getMockLines('all')).toMatchInlineSnapshot(`
      "[log] Found 4 changed files in current branch (before filtering)
      [log]   - ~~src/foo.test.js~~ (ignored by pattern "**/*.test.js")
      [log]   - ~~tests/stuff.js~~ (ignored by pattern "tests/**")
      [log]   - ~~yarn.lock~~ (ignored by pattern "yarn.lock")
      [log]   - ~~CHANGELOG.md~~ (ignored by pattern "CHANGELOG.{md,json}")
      [log] All files were ignored"
    `);
  });

  it('respects ignorePatterns in monorepo', () => {
    const result = getAllChangedPackagesWrapper({
      packageInfos: monorepoPackageInfos(),
      allChangedFiles: [
        'packages/foo/foo.test.js',
        'packages/bar/tests/stuff.js',
        'packages/bar/jest.config.js',
        'packages/baz/CHANGELOG.md',
        'packages/baz/publishme.js',
        'yarn.lock',
      ],
      repoOptions: { ignorePatterns: ['**/*.test.js', '**/tests/**', 'jest.config.js'] },
      extraArgv: ['--verbose'],
    });
    expect(result).toEqual(['baz']);
    expect(logs.getMockLines('all')).toMatchInlineSnapshot(`
      "[log] Found 6 changed files in current branch (before filtering)
      [log]   - ~~packages/foo/foo.test.js~~ (ignored by pattern "**/*.test.js")
      [log]   - ~~packages/bar/tests/stuff.js~~ (ignored by pattern "**/tests/**")
      [log]   - ~~packages/bar/jest.config.js~~ (ignored by pattern "jest.config.js")
      [log]   - ~~packages/baz/CHANGELOG.md~~ (ignored by pattern "CHANGELOG.{md,json}")
      [log]   - packages/baz/publishme.js
      [log]   - ~~yarn.lock~~ (not in a package)
      [log] Found 1 file in 1 package that should be published"
    `);
  });

  // This is tested at a lower level by isPackageIncluded.test.ts
  it('ignores package changes as appropriate', () => {
    const packageInfos = monorepoPackageInfos();
    // Update packages so they'll be ignored
    packageInfos.foo.private = true;
    packageInfos.bar.packageOptions = { shouldPublish: false }; // package.json beachball field

    const result = getAllChangedPackagesWrapper({
      packageInfos,
      repoOptions: { scope: ['!packages/grouped/*'] },
      allChangedFiles: [
        'packages/foo/foo.js',
        'packages/bar/bar.js',
        'packages/baz/baz.js', // only this one triggers publishing
        'packages/grouped/a/grouped.js',
        'packages/grouped/b/grouped.js',
      ],
    });

    expect(result).toEqual(['baz']);
    const logLines = logs.getMockLines('all');
    expect(logLines).toMatchInlineSnapshot(`""`);
  });
});
