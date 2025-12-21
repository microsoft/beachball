import { getCatalogVersion, isCatalogVersion, type Catalogs } from 'workspace-tools';
import type { PackageInfos } from '../types/PackageInfo';
import { getWorkspaceRange } from './getWorkspaceRange';

/**
 * Resolve a `workspace:` or `catalog:` version/range to an actual version.
 * Throws if it's one of those version types but can't be resolved.
 * @returns The resolved version, or undefined if the range is not a supported special range.
 */
export function resolveSpecialVersion(params: {
  depName: string;
  depVersion: string;
  catalogs: Catalogs | undefined;
  packageInfos: PackageInfos;
}): string | undefined {
  const { depName, depVersion, catalogs, packageInfos } = params;

  let versionFromCatalog: string | undefined;
  if (isCatalogVersion(depVersion)) {
    // Replace basic catalog versions. (getCatalogVersion throws if a catalog version is present
    // and invalid, but that's very unlikely since the package manager would have errored too.)
    versionFromCatalog = getCatalogVersion({ name: depName, version: depVersion, catalogs });
    if (versionFromCatalog && !getWorkspaceRange(versionFromCatalog)) {
      // If the catalog version is not a workspace version, use it directly
      return versionFromCatalog;
    }
  }

  // Check for a workspace: version (there's a slight chance one could be nested inside a catalog)
  const workspaceRange = getWorkspaceRange(depVersion) || (versionFromCatalog && getWorkspaceRange(versionFromCatalog));
  if (workspaceRange) {
    const packageInfo = packageInfos[depName];
    if (!packageInfo) {
      // workspace: version referenced a package that isn't in the repo
      const referenceVersion = versionFromCatalog ? `"${depVersion}" -> "${versionFromCatalog}"` : `"${depVersion}"`;
      throw new Error(
        `Package "${depName}" (referenced by version ${referenceVersion}) not found in workspace packages`
      );
    }

    // Resolve to actual version per specs
    // https://pnpm.io/workspaces#workspace-protocol-workspace
    // https://yarnpkg.com/features/workspaces#publishing-workspaces
    return workspaceRange === '*'
      ? packageInfo.version
      : workspaceRange === '^' || workspaceRange === '~'
      ? `${workspaceRange}${packageInfo.version}`
      : workspaceRange;
  }
}
