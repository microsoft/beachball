import fs from 'fs-extra';
import path from 'path';
import minimatch from 'minimatch';
import type { ChangeFileInfo, ChangeInfoMultiple } from '../types/ChangeInfo';
import { getChangePath } from '../paths';
import { getChanges, getStagedChanges, git } from 'workspace-tools';
import { getScopedPackages } from '../monorepo/getScopedPackages';
import type { BeachballOptions } from '../types/BeachballOptions';
import type { PackageInfos, PackageInfo } from '../types/PackageInfo';
import { ensureSharedHistory } from '../git/ensureSharedHistory';

const count = (n: number, str: string) => `${n} ${str}${n === 1 ? '' : 's'}`;

function getMatchingPackageInfo(
  file: string,
  cwd: string,
  packageInfosByPath: { [packageAbsNormalizedPath: string]: PackageInfo }
): PackageInfo | undefined {
  // Normalize all the paths before comparing (the packageInfosByPath entries should also be normalized)
  // to ensure ensure that this doesn't break on Windows if any input paths have forward slashes
  cwd = path.normalize(cwd);
  const absFile = path.normalize(path.join(cwd, file));
  let absDir = '';

  do {
    absDir = path.dirname(absDir || absFile);
    if (packageInfosByPath[absDir]) {
      return packageInfosByPath[absDir];
    }
  } while (absDir !== cwd);

  return undefined;
}

/**
 * Determines whether the package is included in the list of potentially-changed published packages,
 * based on private flags and scopedPackages.
 */
function isPackageIncluded(
  packageInfo: PackageInfo | undefined,
  scopedPackages: string[]
): { isIncluded: boolean; reason: string } {
  const reason = !packageInfo
    ? 'no corresponding package found'
    : packageInfo.private
    ? `${packageInfo.name} is private`
    : packageInfo.combinedOptions.shouldPublish === false
    ? `${packageInfo.name} has beachball.shouldPublish=false`
    : !scopedPackages.includes(packageInfo.name)
    ? `${packageInfo.name} is out of scope`
    : ''; // not ignored

  return { isIncluded: !reason, reason };
}

/**
 * Gets all the changed package names, regardless of the change files.
 * If `options.all` is set, returns all the packages in scope, regardless of whether they've changed.
 */
function getAllChangedPackages(options: BeachballOptions, packageInfos: PackageInfos): string[] {
  const { branch, path: cwd, verbose, all, changeDir } = options;

  const verboseLog = (msg: string) => verbose && console.log(msg);
  const logIgnored = (file: string, reason: string) => verboseLog(`  - ~~${file}~~ (${reason})`);
  const logIncluded = (file: string) => verboseLog(`  - ${file}`);

  const scopedPackages = getScopedPackages(options, packageInfos);

  // If --all is set, return all the packages in scope rather than looking at which files changed
  if (all) {
    verboseLog('--all option was provided, so including all packages that are in scope (regardless of changes)');
    return Object.values(packageInfos)
      .filter(pkg => {
        const { isIncluded, reason } = isPackageIncluded(pkg, scopedPackages);
        verboseLog(isIncluded ? `  - ${pkg.name}` : `  - ~~${pkg.name}~~ (${reason.replace(`${pkg.name} `, '')})`);
        return isIncluded;
      })
      .map(pkg => pkg.name);
  }

  const changes = [...(getChanges(branch, cwd) || []), ...(getStagedChanges(cwd) || [])];
  verboseLog(`Found ${count(changes.length, 'changed file')} in branch "${branch}" (before filtering)`);

  if (!changes.length) {
    return [];
  }

  // Filter out changed files which are ignored by ignorePatterns.
  // Also ignore the CHANGELOG files and change files because they're generated by beachball.
  const ignorePatterns = [...(options.ignorePatterns || []), `${changeDir}/*.json`, 'CHANGELOG.{md,json}'];
  const nonIgnoredChanges = changes.filter(moddedFile => {
    const ignorePattern = ignorePatterns.find(pattern => minimatch(moddedFile, pattern, { matchBase: true }));
    ignorePattern && logIgnored(moddedFile, `ignored by pattern "${ignorePattern}"`);
    return !ignorePattern;
  });
  if (!nonIgnoredChanges.length) {
    verboseLog('All files were ignored');
    return [];
  }

  // Determine which package each changed file came from (using packageInfos[x].packageJsonPath),
  // and whether that package is in scope and not private
  const includedPackages = new Set<string>();
  let fileCount = 0;
  const packageInfosByPath: { [packageAbsNormalizedPath: string]: PackageInfo } = {};
  for (const info of Object.values(packageInfos)) {
    packageInfosByPath[path.normalize(path.dirname(info.packageJsonPath))] = info;
  }
  for (const moddedFile of nonIgnoredChanges) {
    const packageInfo = getMatchingPackageInfo(moddedFile, cwd, packageInfosByPath);
    if (!packageInfo) continue;

    const { isIncluded, reason } = isPackageIncluded(packageInfo, scopedPackages);

    if (!isIncluded) {
      logIgnored(moddedFile, reason);
    } else {
      includedPackages.add(packageInfo.name);
      fileCount++;
      logIncluded(moddedFile);
    }
  }

  verboseLog(
    `Found ${count(fileCount, 'file')} in ${count(includedPackages.size, 'package')} that should be published`
  );

  return [...includedPackages];
}

/**
 * Gets all the changed packages which do not already have a change file
 */
export function getChangedPackages(options: BeachballOptions, packageInfos: PackageInfos): string[] {
  const { path: cwd, branch, changeDir } = options;

  const changePath = getChangePath(options);

  ensureSharedHistory(options);

  const changedPackages = getAllChangedPackages(options, packageInfos);

  const changedFilesResult = git(
    ['diff', '--name-only', '--relative', '--no-renames', '--diff-filter=A', `${branch}...`],
    { cwd }
  );

  if (!fs.existsSync(changePath) || !changedFilesResult.success) {
    return changedPackages;
  }

  const changeFiles = changedFilesResult.stdout.split('\n').filter(name => path.dirname(name) === changeDir);
  const changeFilePackageSet = new Set<string>();

  // Loop through the change files, building up a set of packages that we can skip
  for (const file of changeFiles) {
    try {
      const changeInfo = fs.readJSONSync(path.join(cwd, file)) as ChangeFileInfo | ChangeInfoMultiple;
      const changes = (changeInfo as ChangeInfoMultiple).changes || [changeInfo];

      for (const change of changes) {
        changeFilePackageSet.add(change.packageName);
      }
    } catch (e) {
      console.warn(`Error reading or parsing change file ${file}: ${e}`);
    }
  }

  if (changeFilePackageSet.size > 0) {
    console.log(
      'Your local repository already has change files for these packages:' +
        [...changeFilePackageSet]
          .sort()
          .map(pkg => `\n  ${pkg}`)
          .join('')
    );
  }

  return changedPackages.filter(pkgName => !changeFilePackageSet.has(pkgName));
}
