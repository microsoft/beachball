import semver from 'semver';
import { getWorkspaceRange } from '../packageManager/getWorkspaceRange';

export function bumpMinSemverRange(minVersion: string, semverRange: string): string {
  if (semverRange === '*' || semverRange.startsWith('file:')) {
    return semverRange;
  }

  const workspaceRange = getWorkspaceRange(semverRange);

  if (workspaceRange === '*' || workspaceRange === '~' || workspaceRange === '^') {
    // For basic workspace ranges we can just preserve current value and replace during publish
    // https://pnpm.io/workspaces#workspace-protocol-workspace
    return semverRange;
  }
  if (semverRange[0] === '~' || semverRange[0] === '^') {
    // ~1.0.0
    // ^1.0.0
    return semverRange[0] + minVersion;
  }
  if (workspaceRange && (workspaceRange[0] === '~' || workspaceRange[0] === '^')) {
    // workspace:~1.0.0
    // workspace:^1.0.0
    return `workspace:${workspaceRange[0]}${minVersion}`;
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
