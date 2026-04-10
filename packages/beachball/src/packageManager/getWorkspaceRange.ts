const workspacePrefix = 'workspace:';

/**
 * If the version is a [workspace range](https://yarnpkg.com/features/workspaces/#workspace-ranges-workspace),
 * (starts with `workspace:` protocol), return the semver range or in-workspace path.
 * Otherwise return undefined.
 *
 * Example: `workspace:~1.0.0` -> `~1.0.0`, `workspace:^` -> `^`
 *
 * @param version Dependency version from package.json
 */
export function getWorkspaceRange(version: string): string | undefined {
  if (version.startsWith(workspacePrefix)) {
    return version.slice(workspacePrefix.length);
  }
  return undefined;
}
