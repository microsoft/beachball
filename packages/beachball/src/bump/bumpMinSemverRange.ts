import semver from 'semver';

export function bumpMinSemverRange(minVersion: string, semverRange: string) {
  if (semverRange === '*') {
    return semverRange;
  }

  if (semverRange.startsWith('~') || semverRange.startsWith('^')) {
    // ~1.0.0
    // ^1.0.0
    return semverRange[0] + minVersion;
  } else if (semverRange.includes('>')) {
    // Less frequently used, but we treat any of these kinds of ranges to be within a minor band for now: more complex understand of the semver range utility is needed to do more
    // >=1.0.0 <2.0.0
    return `>=${minVersion} <${semver.inc(minVersion, 'major')}`;
  } else if (semverRange.includes(' - ')) {
    // 1.0.0 - 2.0.0
    return `${minVersion} - ${semver.inc(minVersion, 'major')}`;
  }
  return minVersion;
}
