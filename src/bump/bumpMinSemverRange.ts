import semver from 'semver';

export function bumpMinSemverRange(minVersion: string, semverRange: string): string {
  if (semverRange === '*') {
    return semverRange;
  }
  if (['workspace:*', 'workspace:~', 'workspace:^'].includes(semverRange)) {
    // For basic workspace ranges we can just preserve current value and replace during publish
    // https://pnpm.io/workspaces#workspace-protocol-workspace
    return semverRange;
  }
  if (semverRange[0] === '~' || semverRange[0] === '^') {
    // ~1.0.0
    // ^1.0.0
    return semverRange[0] + minVersion;
  }
  if (semverRange.startsWith('workspace:~') || semverRange.startsWith('workspace:^')) {
    // workspace:~1.0.0
    // workspace:^1.0.0
    return `workspace:${semverRange[10]}${minVersion}`;
  }
  if (semverRange.includes('>')) {
    // Less frequently used, but we treat any of these kinds of ranges to be within a minor band for now:
    // more complex understanding of the semver range utility is needed to do more
    // >=1.0.0 <2.0.0
    return `>=${minVersion} <${semver.inc(minVersion, 'major')}`;
  }
  if (semverRange.includes(' - ')) {
    // 1.0.0 - 2.0.0
    return `${minVersion} - ${semver.inc(minVersion, 'major')}`;
  }
  return minVersion;
}
