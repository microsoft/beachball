import micromatch from 'micromatch';

/**
 * Check if a relative path should be included given include and exclude patterns using micromatch.
 */
export function isPathIncluded(relativePath: string, include: string | string[], exclude?: string | string[]): boolean {
  const includePatterns = typeof include === 'string' ? [include] : include;
  let shouldInclude = includePatterns.reduce(
    (included, pattern) => included || micromatch.isMatch(relativePath, pattern),
    false
  );

  if (exclude) {
    const excludePatterns = typeof exclude === 'string' ? [exclude] : exclude;
    shouldInclude = excludePatterns.reduce(
      (excluded: boolean, pattern: string) => excluded && micromatch.isMatch(relativePath, pattern),
      shouldInclude
    );
  }

  return shouldInclude;
}
