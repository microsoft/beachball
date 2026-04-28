import fs from 'fs';
import path from 'path';
import type { ChangeFileInfo, ChangeInfoMultiple } from '../types/ChangeInfo';
import { getChangePath } from '../paths';
import { getChangesBetweenRefs, getStagedChanges } from 'workspace-tools';
import type { BeachballOptions } from '../types/BeachballOptions';
import type { PackageInfos, ScopedPackages } from '../types/PackageInfo';
import { readJson } from '../object/readJson';
import { bulletedList } from '../logging/bulletedList';
import { getAllChangedPackages } from './getAllChangedPackages';
import { getIncludedLoggers, isPackageIncluded } from './isPackageIncluded';
import { ensureSharedHistory, hasCommonCommit } from '../git/ensureSharedHistory';

/**
 * Gets all the changed packages which **do not already have a change file** and are in scope.
 *
 * Exceptions:
 * - If `options.package` is provided, use that as-is (skipping all git operations).
 * - If `options.all` is true, gets all the packages in scope regardless of whether they've changed
 *   (skipping git diff of files), filtered by packages that already have change files.
 */
export function getChangedPackages(
  options: BeachballOptions,
  packageInfos: PackageInfos,
  scopedPackages: ScopedPackages
): string[] {
  const { branch } = options;
  const { verboseLog, logIncluded, logIgnored } = getIncludedLoggers(options);

  if (options.package) {
    return typeof options.package === 'string' ? [options.package] : [...options.package];
  }

  console.log(`Checking for changes against "${options.branch}"`);

  // We should fetch shared history even with --all for accurate change file checks later
  if (!hasCommonCommit(branch, options.path)) {
    ensureSharedHistory(options);
  }

  let changedPackages: string[];

  if (options.all) {
    // If --all is set, return all the packages in scope rather than looking at which files changed
    verboseLog('--all option was provided, so including all packages that are in scope (regardless of changes)');
    changedPackages = Object.values(packageInfos)
      .filter(pkg => {
        const { isIncluded, reason } = isPackageIncluded(pkg, scopedPackages);
        isIncluded ? logIncluded(pkg.name) : logIgnored(pkg.name, reason.replace(`${pkg.name} `, ''));
        return isIncluded;
      })
      .map(pkg => pkg.name);
  } else {
    changedPackages = getAllChangedPackages({ options, packageInfos, scopedPackages });
  }

  const changePath = getChangePath(options);
  if (!fs.existsSync(changePath)) {
    return [...changedPackages];
  }

  // TODO: this should probably reuse the result of readChangeFiles, but they use slightly different args...
  const committedChangeFiles = getChangesBetweenRefs({
    fromRef: branch,
    options: ['--no-renames', '--diff-filter=A'],
    // Only list files under the change folder for efficiency
    cwd: changePath,
    pattern: '*.json',
    throwOnError: false,
  });
  // Also consider staged change files (not yet committed) so that `check` respects them
  const stagedChangeFiles = (getStagedChanges({ cwd: changePath }) || []).filter(f => f.endsWith('.json'));
  const changeFiles = [...new Set([...committedChangeFiles, ...stagedChangeFiles])];

  const changeFilePackageSet = new Set<string>();

  // Loop through the change files, building up a set of packages that we can skip
  for (const file of changeFiles) {
    const changeFilePath = path.join(changePath, file);
    try {
      const changeInfo = readJson<ChangeFileInfo | ChangeInfoMultiple>(changeFilePath);
      const changes = (changeInfo as ChangeInfoMultiple).changes || [changeInfo];

      for (const change of changes) {
        if (change.packageName) {
          changeFilePackageSet.add(change.packageName);
        }
      }
    } catch (e) {
      console.warn(`Error reading or parsing change file ${changeFilePath}: ${e}`);
    }
  }

  if (changeFilePackageSet.size > 0) {
    console.log(
      'Your local repository already has change files for these packages:\n' +
        bulletedList([...changeFilePackageSet].sort())
    );
  }

  return changedPackages.filter(pkgName => !changeFilePackageSet.has(pkgName));
}
