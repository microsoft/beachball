import fs from 'fs';
import path from 'path';
import { getBranchChanges, getChangesBetweenRefs, getStagedChanges } from 'workspace-tools';
import type { ChangeFileInfo, ChangeInfoMultiple } from '../types/ChangeInfo';
import { getChangePath } from '../paths';
import type { BeachballOptions } from '../types/BeachballOptions';
import type { PackageInfos, ScopedPackages } from '../types/PackageInfo';
import { readJson } from '../object/readJson';
import { bulletedList } from '../logging/bulletedList';
import { getAllChangedPackages } from './getAllChangedPackages';
import { getCatalogChangedPackages } from './getCatalogChangedPackages';
import { getIncludedLoggers, isPackageIncluded } from './isPackageIncluded';
import { ensureSharedHistory } from '../git/ensureSharedHistory';

/**
 * Gets all the changed packages which **do not already have a change file** and are in scope.
 * This includes all packages which should change due to catalog version changes.
 * This is only used by the `change` and `check` commands, not the bump/publish process.
 *
 * Special cases:
 * - If `options.package` is provided, use that as-is (skipping all git operations).
 * - If `options.all` is true, gets all the packages in scope regardless of whether they've changed
 *   (skipping git diff of files), omitting packages that already have change files.
 *
 * Usually (without `options.package`) this has the side effect of calling `ensureSharedHistory` to
 * verify that enough git history is available to check for changes between `HEAD` and
 * `options.branch` (only an issue for shallow clones), and deepens the history if needed.
 * Unless `options.fetch` is `false`, it will also fetch from the remote.
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

  console.log(`Checking for changes against "${branch}"`);

  // Ensure the current branch and target branch have a common shared commit. This has the side
  // effect of fetching from the remote (unless disabled), which should be done even if there's
  // already shared history (and even with --all) for accurate added change file checks later.
  ensureSharedHistory(options);

  let changedPackages: Set<string>;
  let stagedFiles: string[] | undefined;

  if (options.all) {
    // If --all is set, return all the packages in scope rather than looking at which files changed
    verboseLog('--all option was provided, so including all packages that are in scope (regardless of changes)');
    changedPackages = new Set(
      Object.values(packageInfos)
        .filter(pkg => {
          const { isIncluded, reason } = isPackageIncluded(pkg, scopedPackages);
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          isIncluded ? logIncluded(pkg.name) : logIgnored(pkg.name, reason.replace(`${pkg.name} `, ''));
          return isIncluded;
        })
        .map(pkg => pkg.name)
    );
  } else {
    stagedFiles = getStagedChanges({ cwd: options.path }) || [];
    const committedFiles = getBranchChanges({ branch, cwd: options.path }) || [];
    // dedupe with a Set in case a file was already committed and has more changes staged
    const allChangedFiles = new Set([...committedFiles, ...stagedFiles]);

    const directChangedPackages = getAllChangedPackages({ options, packageInfos, scopedPackages, allChangedFiles });
    const catalogChangedPackages = getCatalogChangedPackages({
      options,
      packageInfos,
      scopedPackages,
      allChangedFiles,
    });
    changedPackages = new Set([...directChangedPackages, ...catalogChangedPackages]);
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
  const relChangeDir = path.relative(options.path, changePath).replace(/\\/g, '/') + '/';
  const stagedChangeFiles = (
    stagedFiles?.filter(f => f.startsWith(relChangeDir)).map(f => f.replace(relChangeDir, '')) ||
    getStagedChanges({ cwd: changePath })
  ).filter(f => f.endsWith('.json'));
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
          changedPackages.delete(change.packageName);
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

  return [...changedPackages];
}
