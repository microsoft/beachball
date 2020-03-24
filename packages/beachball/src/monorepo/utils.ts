import minimatch from 'minimatch';

/**
 * Check if a relative path should be included given include and exclude patterns using minimatch.
 */
export function isPathIncluded(relativePath: string, include: string | string[], exclude?: string | string[]) {
  const includePatterns = typeof include === 'string' ? [include] : include;
  let shouldInclude = includePatterns.reduce(
    (included, pattern) => included || minimatch(relativePath, pattern),
    false
  );

  if (exclude) {
    const excludePatterns = typeof exclude === 'string' ? [exclude] : exclude;
    shouldInclude = excludePatterns.reduce(
      (excluded: boolean, pattern: string) => excluded && minimatch(relativePath, pattern),
      shouldInclude
    );
  }

  return shouldInclude;
}
