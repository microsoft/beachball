import {
  getCatalogFilePath,
  getCatalogs,
  getCatalogVersion,
  getFileFromRef,
  parseCatalogContent,
} from 'workspace-tools';
import type { BeachballOptions } from '../types/BeachballOptions';
import { type PackageInfos, consideredDependencies, type ScopedPackages } from '../types/PackageInfo';
import { getIncludedLoggers, isPackageIncluded } from './isPackageIncluded';
import { diffCatalogs } from '../monorepo/diffCatalogs';
import path from 'path';

/**
 * Get the packages that were changed due to catalog version modifications.
 *
 * PRE: Assumes shared git history has already been fetched, probably by `getChangedPackages`.
 */
export function getCatalogChangedPackages(params: {
  packageInfos: PackageInfos;
  scopedPackages: ScopedPackages;
  options: Pick<BeachballOptions, 'branch' | 'path' | 'verbose'>;
  /**
   * All changed file paths in the current branch, relative to `options.path` with forward slashes.
   * This is only used to determine if the file which might have catalog info has changed (to avoid
   * reading it from git history in the most common case where it hasn't changed).
   */
  allChangedFiles: Set<string>;
}): string[] {
  const { options, packageInfos, scopedPackages, allChangedFiles } = params;
  const { branch, path: cwd } = options;
  const { verboseLog, logIncluded } = getIncludedLoggers(options);

  const currentCatalogs = getCatalogs(cwd);
  const catalogFilePath = currentCatalogs && getCatalogFilePath(cwd);
  // If there are catalogs, convert the file path to relative with forward slashes for comparison
  // with git output. (Do the slash conversion to be safe, but realistically this should be either
  // .yarnrc.yml, package.json, or pnpm-workspace.yaml directly under cwd.)
  const relCatalogFilePath = catalogFilePath && path.relative(cwd, catalogFilePath.filePath).replace(/\\/g, '/');

  // If the repo doesn't define catalogs or the catalog file hasn't changed, return early
  // (skip the git operation to read the file from history, since this can be expensive in
  // very large repos, and the change command is run frequently by developers)
  if (!relCatalogFilePath || !currentCatalogs || !allChangedFiles.has(relCatalogFilePath)) {
    return [];
  }

  verboseLog('Checking for changes to catalog: dependencies...');

  // Get the old catalog file content from the branch we're comparing against
  const oldCatalogFileContent = getFileFromRef({ ref: branch, filePath: relCatalogFilePath, cwd });
  const oldCatalogs = oldCatalogFileContent
    ? parseCatalogContent(oldCatalogFileContent, catalogFilePath.manager)
    : undefined;

  // Calculate the diff before going into packages, so we only check everything in the less-common
  // case that a catalog version has changed
  const catalogsDiff = oldCatalogs ? diffCatalogs({ before: oldCatalogs, after: currentCatalogs }) : currentCatalogs;
  if (!catalogsDiff) {
    verboseLog('No catalog: changes found');
    return [];
  }

  const changedPackages: string[] = [];

  const changedCatalogDepNames = [
    Object.keys(catalogsDiff.default || {}),
    Object.values(catalogsDiff.named || {}).map(catalog => Object.keys(catalog)),
  ].flat(2);

  for (const pkg of Object.values(packageInfos)) {
    // Skip logging exclude reasons for catalog references
    if (!isPackageIncluded(pkg, scopedPackages).isIncluded) continue;

    const changedDeps: string[] = [];

    for (const depType of consideredDependencies) {
      const deps = pkg[depType];
      if (!deps) continue;

      for (const [name, version] of Object.entries(deps)) {
        // If this dep name might be one of the changed catalog dependencies, check if the version
        // specified in this package can be resolved from the catalog diff. If so, it's a change.
        // (it's possible some package could specify a non-catalog version of the same dep)
        if (
          changedCatalogDepNames.includes(name) &&
          getCatalogVersion({ name, version, catalogs: catalogsDiff, allowNotFound: true })
        ) {
          changedDeps.push(name);
        }
      }
    }

    if (changedDeps.length) {
      if (!changedPackages.length) {
        verboseLog('catalog: dependencies referenced by the following packages have changed:');
      }
      changedPackages.push(pkg.name);
      logIncluded(`${pkg.name}: ${changedDeps.join(', ')}`);
    }
  }

  if (!changedPackages.length) {
    verboseLog('No changes found to catalog: dependencies of in-scope published packages');
  }

  return changedPackages;
}
