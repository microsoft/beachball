import minimatch from 'minimatch';

/**
 * Check if a relative package path should be included given include and exclude patterns using minimatch.
 */
export function isPathIncluded(params: {
  /** Relative path to the package from the repo root. */
  relativePath: string;
  /** Include pattern(s). If `true`, include all paths except those excluded. */
  include: string | string[] | true;
  /** Exclude pattern(s). As of v3, these are no longer negated patterns. */
  exclude?: string | string[];
}): boolean {
  const { relativePath, include, exclude } = params;

  let shouldInclude: boolean;
  if (include === true) {
    shouldInclude = true;
  } else {
    const includePatterns = typeof include === 'string' ? [include] : include;
    shouldInclude = includePatterns.some(pattern => minimatch(relativePath, pattern));
  }

  if (exclude?.length && shouldInclude) {
    const excludePatterns = typeof exclude === 'string' ? [exclude] : exclude;
    shouldInclude = !excludePatterns.some(pattern => minimatch(relativePath, pattern));
  }

  return shouldInclude;
}
