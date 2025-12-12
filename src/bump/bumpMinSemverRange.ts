import semver from 'semver';
import { getWorkspaceRange } from '../packageManager/getWorkspaceRange';

/**
 * Bump the semver range for a dependency to match the new version of a package.
 * @param newVersion The new version of the package
 * @param currentRange Current version range for the dependency.
 * @returns New semver range for the dependency
 */
export function bumpMinSemverRange(newVersion: string, currentRange: string): string {
  if (currentRange === '*' || currentRange.startsWith('file:') || currentRange.startsWith('catalog:')) {
    return currentRange;
  }

  if (currentRange[0] === '~' || currentRange[0] === '^') {
    // ~1.0.0
    // ^1.0.0
    return currentRange[0] + newVersion;
  }

  const workspaceRange = getWorkspaceRange(currentRange);
  if (workspaceRange === '*' || workspaceRange === '~' || workspaceRange === '^') {
    // For basic workspace ranges we can just preserve current value and replace during publish
    // https://pnpm.io/workspaces#workspace-protocol-workspace
    return currentRange;
  }
  if (workspaceRange && (workspaceRange[0] === '~' || workspaceRange[0] === '^')) {
    // workspace:~1.0.0
    // workspace:^1.0.0
    return `workspace:${workspaceRange[0]}${newVersion}`;
  }

  if (currentRange.includes('>')) {
    // Less frequently used, but use the new version as a minimum for this kind of range.
    // more complex understanding of the semver range utility is needed to do more
    // >=1.0.0 <2.0.0
    return `>=${newVersion} <${semver.inc(newVersion, 'major')}`;
  }
  if (currentRange.includes(' - ')) {
    // 1.0.0 - 2.0.0
    return `${newVersion} - ${semver.inc(newVersion, 'major')}`;
  }

  if (semver.valid(currentRange)) {
    // Exact version match, e.g. 1.0.0
    return newVersion;
  }

  // For unrecognized valid semver ranges: if the new version satisfies the current range, keep it
  if (semver.validRange(currentRange) && semver.satisfies(newVersion, currentRange)) {
    return currentRange;
  }

  // Fallback: return the exact new version
  return newVersion;
}
