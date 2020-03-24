import minimatch from 'minimatch';

export function isPathIncluded(relativePath: string, include: string | string[], exclude?: string | string[]) {
  const includePatterns = typeof include === 'string' ? [include] : include;
  let includedFlag = includePatterns.reduce((included, pattern) => included || minimatch(relativePath, pattern), false);

  let excludedFlag = false;

  if (exclude) {
    const excludePatterns = typeof exclude === 'string' ? [exclude] : exclude;
    excludedFlag = excludePatterns.reduce(
      (excluded: boolean, pattern: string) => excluded || minimatch(relativePath, pattern),
      false
    );
  }

  return includedFlag && !excludedFlag;
}
