import minimatch from 'minimatch';

/**
 * Check if a relative path should be included given include and exclude patterns using minimatch.
 * @param relativePath Relative path to check.
 * @param include Include pattern(s). If `true`, include all paths except those excluded.
 * @param exclude Exclude pattern(s). Currently these must be **negated** patterns:
 * e.g. if you want to exclude `packages/foo`, you must specify `exclude` as `!packages/foo`.
 * (This will be fixed in a future major version.)
 */
export function isPathIncluded(params: {
  relativePath: string;
  include: string | string[] | true;
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
