import { describe, expect, it, jest } from '@jest/globals';
import { filterIgnoredFiles } from '../../monorepo/filterIgnoredFiles';

// These tests aren't meant to cover all glob cases, but they should verify that basic cases
// and known problematic cases stay the same if switching glob libraries or changing options.
describe('filterIgnoredFiles', () => {
  it('returns all paths when ignorePatterns is undefined', () => {
    const filePaths = ['src/index.ts', 'README.md'];
    expect(filterIgnoredFiles({ filePaths, ignorePatterns: undefined })).toEqual(filePaths);
  });

  it('returns all paths when ignorePatterns is empty', () => {
    const filePaths = ['src/index.ts', 'README.md'];
    expect(filterIgnoredFiles({ filePaths, ignorePatterns: [] })).toEqual(filePaths);
  });

  it('filters paths matching a pattern (no **)', () => {
    const result = filterIgnoredFiles({
      filePaths: ['src/index.ts', 'src/index.test.ts', 'README.md', 'CHANGELOG.md', 'foo.md'],
      ignorePatterns: ['src/*.test.ts', 'CHANGELOG.{md,json}', 'foo.md'],
    });
    expect(result).toEqual(['src/index.ts', 'README.md']);
  });

  it('matches basenames at any depth (matchBase)', () => {
    // patterns without slashes match against the basename
    const result = filterIgnoredFiles({
      filePaths: ['README.md', 'docs/README.md', 'src/index.ts', 'src/sub/foo.test.ts', 'src/index.test.ts'],
      ignorePatterns: ['README.md', '*.test.ts'],
    });
    expect(result).toEqual(['src/index.ts']);
  });

  // There are some known edge cases of ** behavior between libraries, so these tests ensure that
  // behavior stays consistent if switching glob libraries.
  describe('globstar patterns', () => {
    it('"foo/**" filters files under foo at any depth', () => {
      // does NOT match "foo" itself (no trailing slash) — only paths under foo
      const result = filterIgnoredFiles({
        filePaths: ['foo', 'foo/bar.ts', 'foo/sub/bar.ts', 'other/bar.ts'],
        ignorePatterns: ['foo/**'],
      });
      expect(result).toEqual(['foo', 'other/bar.ts']);
    });

    it('"foo/**/*" filters files under foo at any depth', () => {
      // for typical file paths (no trailing slash), this behaves the same as "foo/**"
      const result = filterIgnoredFiles({
        filePaths: ['foo', 'foo/bar.ts', 'foo/sub/bar.ts', 'other/bar.ts'],
        ignorePatterns: ['foo/**/*'],
      });
      expect(result).toEqual(['foo', 'other/bar.ts']);
    });

    it('"foo/*" only filters direct children of foo', () => {
      const result = filterIgnoredFiles({
        filePaths: ['foo', 'foo/bar.ts', 'foo/sub/bar.ts', 'other/bar.ts'],
        ignorePatterns: ['foo/*'],
      });
      expect(result).toEqual(['foo', 'foo/sub/bar.ts', 'other/bar.ts']);
    });

    it('"**/*.ts" filters .ts files at any depth', () => {
      const result = filterIgnoredFiles({
        filePaths: ['index.ts', 'src/a.ts', 'src/sub/b.ts', 'README.md'],
        ignorePatterns: ['**/*.ts'],
      });
      expect(result).toEqual(['README.md']);
    });

    it('"foo/**/*.ts" filters .ts files under foo at any depth', () => {
      const result = filterIgnoredFiles({
        filePaths: ['foo/a.ts', 'foo/sub/b.ts', 'src/c.ts', 'foo/README.md'],
        ignorePatterns: ['foo/**/*.ts'],
      });
      expect(result).toEqual(['src/c.ts', 'foo/README.md']);
    });
  });

  describe('logIgnored', () => {
    it('is called for each ignored file with the matching pattern', () => {
      const logIgnored = jest.fn();
      filterIgnoredFiles({
        filePaths: ['src/a.test.ts', 'src/b.ts', 'CHANGELOG.md'],
        ignorePatterns: ['*.test.ts', 'CHANGELOG.md'],
        logIgnored,
      });
      expect(logIgnored).toHaveBeenCalledTimes(2);
      expect(logIgnored).toHaveBeenCalledWith('src/a.test.ts', 'ignored by pattern "*.test.ts"');
      expect(logIgnored).toHaveBeenCalledWith('CHANGELOG.md', 'ignored by pattern "CHANGELOG.md"');
    });

    it('is not called when no files are ignored', () => {
      const logIgnored = jest.fn();
      filterIgnoredFiles({
        filePaths: ['src/index.ts', 'README.md'],
        ignorePatterns: ['*.test.ts'],
        logIgnored,
      });
      expect(logIgnored).not.toHaveBeenCalled();
    });

    it('reports only the first matching pattern when multiple match', () => {
      const logIgnored = jest.fn();
      filterIgnoredFiles({
        filePaths: ['CHANGELOG.md'],
        ignorePatterns: ['*.md', 'CHANGELOG.md'],
        logIgnored,
      });
      expect(logIgnored).toHaveBeenCalledTimes(1);
      expect(logIgnored).toHaveBeenCalledWith('CHANGELOG.md', 'ignored by pattern "*.md"');
    });
  });
});
