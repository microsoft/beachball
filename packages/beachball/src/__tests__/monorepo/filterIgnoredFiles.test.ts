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

    it('"foo/**/bar.ts" matches bar.ts directly under foo (globstar matches zero dirs)', () => {
      const result = filterIgnoredFiles({
        filePaths: ['foo/bar.ts', 'foo/sub/bar.ts', 'foo/x.ts'],
        ignorePatterns: ['foo/**/bar.ts'],
      });
      expect(result).toEqual(['foo/x.ts']);
    });

    it('"**" matches every path', () => {
      const result = filterIgnoredFiles({
        filePaths: ['a', 'b/c', 'd/e/f'],
        ignorePatterns: ['**'],
      });
      expect(result).toEqual([]);
    });
  });

  // These document behavior that commonly differs between glob libraries/options and should stay
  // consistent if switching implementations.
  describe('edge cases', () => {
    it('matches basenames even inside dot-directories (matchBase parity)', () => {
      // `**` alone does not descend into dot-directories, but the basename fallback restores
      // minimatch's matchBase behavior, so slashless patterns still match files nested under them.
      const result = filterIgnoredFiles({
        filePaths: ['.git/config', 'src/.hidden/a.ts', 'src/a.ts', '.config/app.log'],
        ignorePatterns: ['*.ts', '*.log', 'config'],
      });
      expect(result).toEqual([]);
    });

    it('does not match leading-dot basenames with a non-dot wildcard', () => {
      // `*` does not match a leading dot, so `.env` and `.env.local` are kept.
      const result = filterIgnoredFiles({
        filePaths: ['.env', '.env.local', 'env.ts', 'a.env'],
        ignorePatterns: ['*.env'],
      });
      expect(result).toEqual(['.env', '.env.local', 'env.ts']);
    });

    it('matches leading-dot basenames with an explicit dot pattern', () => {
      const result = filterIgnoredFiles({
        filePaths: ['.env', 'x/.npmrc', 'keep.ts'],
        ignorePatterns: ['.*'],
      });
      expect(result).toEqual(['keep.ts']);
    });

    it('matches a directory basename but not its contents (matchBase is basename-only)', () => {
      // A slashless pattern matches the directory entry itself, but not files under it.
      const result = filterIgnoredFiles({
        filePaths: ['node_modules', 'node_modules/a.js', 'src/node_modules/b.js'],
        ignorePatterns: ['node_modules'],
      });
      expect(result).toEqual(['node_modules/a.js', 'src/node_modules/b.js']);
    });

    it('supports character classes', () => {
      const result = filterIgnoredFiles({
        filePaths: ['a.ts', 'b.ts', 'c.ts', 'd.ts'],
        ignorePatterns: ['[ab].ts'],
      });
      expect(result).toEqual(['c.ts', 'd.ts']);
    });

    it('supports the ? single-character wildcard', () => {
      const result = filterIgnoredFiles({
        filePaths: ['a.ts', 'ab.ts', 'b.ts'],
        ignorePatterns: ['?.ts'],
      });
      expect(result).toEqual(['ab.ts']);
    });

    it('supports nested brace expansion', () => {
      const result = filterIgnoredFiles({
        filePaths: ['a1.ts', 'a2.ts', 'b1.ts'],
        ignorePatterns: ['{a,b}{1,2}.ts'],
      });
      expect(result).toEqual([]);
    });

    it('supports extglob patterns', () => {
      const result = filterIgnoredFiles({
        filePaths: ['ab.ts', 'aab.ts', 'b.ts'],
        ignorePatterns: ['+(a)b.ts'],
      });
      expect(result).toEqual(['b.ts']);
    });

    it('a trailing-slash pattern matches nothing', () => {
      // Known quirk: "foo/" has a slash so it is not treated as a basename pattern, and it does
      // not match the "foo" entry or files under foo.
      const result = filterIgnoredFiles({
        filePaths: ['foo', 'foo/a.ts', 'bar'],
        ignorePatterns: ['foo/'],
      });
      expect(result).toEqual(['foo', 'foo/a.ts', 'bar']);
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
