import minimatch from 'minimatch';

/**
 * Check if a relative path should be included given include and exclude patterns using minimatch.
 * @param relativePath Relative path to check.
 * @param include Include pattern(s). If `true`, include all paths except those excluded.
 * @param exclude Exclude pattern(s). Currently these must be **negated** patterns:
 * e.g. if you want to exclude `packages/foo`, you must specify `exclude` as `!packages/foo`.
 * (This will be fixed in a future major version.)
 */
export function isPathIncluded(
  relativePath: string,
  include: string | string[] | true,
  exclude?: string | string[]
): boolean {
  let shouldInclude: boolean;
  if (include === true) {
    shouldInclude = true;
  } else {
    const includePatterns = typeof include === 'string' ? [include] : include;
    shouldInclude = includePatterns.some(pattern => minimatch(relativePath, pattern));
  }

  if (exclude?.length && shouldInclude) {
    // TODO: this is weird/buggy--it assumes that exclude patterns are always negated,
    // which intuitively (or comparing to other tools) is not how it should work.
    // If this is fixed, updates will be needed in:
    // - getScopedPackages()
    // - ChangelogGroupOptions
    // - VersionGroupOptions
    const excludePatterns = typeof exclude === 'string' ? [exclude] : exclude;
    shouldInclude = excludePatterns.every(pattern => minimatch(relativePath, pattern));
  }

  return shouldInclude;
}
