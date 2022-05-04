import minimatch from 'minimatch';

/**
 * Check if a relative path should be included given include and exclude patterns using minimatch.
 */
export function isPathIncluded(relativePath: string, include: string | string[], exclude?: string | string[]) {
  const includePatterns = typeof include === 'string' ? [include] : include;
  let shouldInclude = includePatterns.some(pattern => minimatch(relativePath, pattern));

  if (exclude && shouldInclude) {
    const excludePatterns = typeof exclude === 'string' ? [exclude] : exclude;
    shouldInclude = !excludePatterns.some(pattern => minimatch(relativePath, pattern));
  }

  return shouldInclude;
}
