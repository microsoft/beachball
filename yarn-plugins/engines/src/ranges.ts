import semver from 'semver';

export function parseRange(range: string | null | undefined): semver.Range | null {
  try {
    const rangeObj = new semver.Range(range || '');
    // From the semver.validRange implementation, it looks like for some invalid cases,
    // object creation succeeds but the range is empty
    return rangeObj.range || rangeObj.raw === '*' ? rangeObj : null;
  } catch {
    return null;
  }
}

/**
 * Returns whether the repo range satisfies the manifest range.
 *
 * An invalid or unspecified `manifestRange` is always satisfied for this purpose.
 * `repoRange` is assumed to have already been validated.
 */
export function isRangeSatisfied(params: {
  repoRange: string | semver.Range;
  manifestRange: string | null | undefined;
  loose?: boolean;
}): boolean {
  const { repoRange, manifestRange, loose } = params;
  const manifestSemver = parseRange(manifestRange);
  const repoMin = semver.minVersion(repoRange);
  if (!manifestSemver || !repoMin) {
    return true;
  }
  return loose ? semver.satisfies(repoMin, manifestSemver) : semver.subset(repoRange, manifestSemver);
}
