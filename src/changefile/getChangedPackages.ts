import fs from 'fs-extra';
import path from 'path';
import minimatch from 'minimatch';
import { ChangeFileInfo, ChangeInfoMultiple } from '../types/ChangeInfo';
import { changeFolder, getChangePath } from '../paths';
import { getChanges, getStagedChanges, git, fetchRemoteBranch, parseRemoteBranch } from 'workspace-tools';
import { getScopedPackages } from '../monorepo/getScopedPackages';
import { BeachballOptions } from '../types/BeachballOptions';
import { PackageInfos, PackageInfo } from '../types/PackageInfo';

/**
 * Ensure that adequate history is available to check for changes between HEAD and `options.branch`.
 * Otherwise attempting to get changes will fail with an error "no merge base".
 */
function ensureHistory(options: BeachballOptions) {
  const { fetch, path: cwd, branch } = options;
  const { remote, remoteBranch } = parseRemoteBranch(branch);

  const fetchMitigationSteps = `- Omit the "--no-fetch" / "--fetch=false" option from the command line
- Remove "fetch: false" from the beachball config
- If this is a CI build, ensure that adequate history is being fetched
  - For GitHub Actions (actions/checkout), add the option "fetch-depth: 0" in the checkout step`;

  if (fetch) {
    // Fetch the latest from the remote branch for comparison
    console.log(`fetching latest from remotes "${remote}/${remoteBranch}"`);
    fetchRemoteBranch(remote, remoteBranch, cwd);
  } else {
    // If fetching is disabled, ensure that the target branch is available for comparison locally
    const hasTargetBranch = git(['rev-parse', '--verify', branch], { cwd }).success;
    if (!hasTargetBranch) {
      // This is most likely to happen in a CI build which does a shallow checkout (github actions/checkout
      // does this by default) and for some reason also disables beachball fetching.
      const mainError = `Target branch "${branch}" does not exist locally, and fetching is disabled.`;
      console.error(`

${mainError} Some possible fixes:
- Fetch the branch manually: git fetch ${remote} ${remoteBranch}
${fetchMitigationSteps}

`);
      throw new Error(mainError);
    }
  }

  // Verify that HEAD and the target branch share history
  const hasCommonCommit = git(['merge-base', branch, 'HEAD'], { cwd }).success;
  if (!hasCommonCommit) {
    // This might be a shallow repo, and it's necessary to unshallow the head branch for comparison
    const isShallow = git(['rev-parse', '--is-shallow-repository'], { cwd }).stdout.trim() === 'true';
    if (isShallow) {
      if (fetch) {
        // Fetch more history (if needed, this could be optimized later to only deepen by e.g. 100 commits at a time)
        // TODO switch to this after workspace-tools update
        // try {
        //   console.log('This is a shallow clone. Unshallowing to check for changes...');
        //   git(['fetch', '--unshallow'], { cwd, throwOnError: true });
        // } catch (err) {
        //   throw new GitError(`Failed to fetch more history for branch "${branch}"`, err);
        // }
        console.log('This is a shallow clone. Unshallowing to check for changes...');
        const result = git(['fetch', '--unshallow'], { cwd });
        if (!result.success) {
          throw new Error(`Failed to fetch more history for branch "${branch}":\n${result.stderr}`);
        }
      } else {
        console.error(`

This repo is a shallow clone, fetching is disabled, and not enough history is available to connect HEAD to "${branch}".
Some possible fixes:

- Verify that you're using the correct target branch
- Unshallow or deepen the clone manually
${fetchMitigationSteps}

`);

        throw new Error(`Inadequate history available for HEAD to connect it to target branch "${branch}".`);
      }
    } else {
      // Not a shallow repo, so it's probably using the wrong target branch
      throw new Error(
        `HEAD does not appear to share history with "${branch}" -- are you using the correct target branch?`
      );
    }
  }
}

function getMatchingPackageInfo(
  file: string,
  cwd: string,
  packageInfosByPath: { [packageAbsNormalizedPath: string]: PackageInfo }
) {
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
 * Gets all the changed package names, regardless of the change files
 */
function getAllChangedPackages(options: BeachballOptions, packageInfos: PackageInfos): string[] {
  const { branch, path: cwd, verbose } = options;

  const verboseLog = (msg: string) => verbose && console.log(msg);
  const logIgnored = (file: string, reason: string) => verboseLog(`  - ~~${file}~~ (${reason})`);
  const logIncluded = (file: string) => verboseLog(`  - ${file}`);

  const changes = [...(getChanges(branch, cwd) || []), ...(getStagedChanges(cwd) || [])];
  verboseLog(`Found ${changes.length} changed files in branch "${branch}" (before filtering)`);

  if (!changes.length) {
    return [];
  }

  // Filter out changed files which are ignored by ignorePatterns.
  // Also ignore the CHANGELOG files and change files because they're generated by beachball.
  const ignorePatterns = [...(options.ignorePatterns || []), `${changeFolder}/*.json`, 'CHANGELOG.{md,json}'];
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
  const scopedPackages = getScopedPackages(options, packageInfos);
  const packageInfosByPath: { [packageAbsNormalizedPath: string]: PackageInfo } = {};
  for (const info of Object.values(packageInfos)) {
    packageInfosByPath[path.normalize(path.dirname(info.packageJsonPath))] = info;
  }
  for (const moddedFile of nonIgnoredChanges) {
    const packageInfo = getMatchingPackageInfo(moddedFile, cwd, packageInfosByPath);

    const omitReason = !packageInfo
      ? 'no corresponding package found'
      : packageInfo.private
      ? `${packageInfo.name} is private`
      : packageInfo.combinedOptions.shouldPublish === false
      ? `${packageInfo.name} has beachball.shouldPublish=false`
      : !scopedPackages.includes(packageInfo.name)
      ? `${packageInfo.name} is out of scope`
      : ''; // not ignored

    if (omitReason) {
      logIgnored(moddedFile, omitReason);
    } else {
      includedPackages.add(packageInfo!.name);
      fileCount++;
      logIncluded(moddedFile);
    }
  }

  verboseLog(`Found ${fileCount} files in ${includedPackages.size} packages that should be published`);

  return [...includedPackages];
}

/**
 * Gets all the changed packages, accounting for change files
 */
export function getChangedPackages(options: BeachballOptions, packageInfos: PackageInfos) {
  const { path: cwd, branch } = options;

  const changePath = getChangePath(cwd);

  ensureHistory(options);

  const changedPackages = getAllChangedPackages(options, packageInfos);

  const changeFilesResult = git(
    ['diff', '--name-only', '--relative', '--no-renames', '--diff-filter=A', `${branch}...`],
    { cwd }
  );

  if (!fs.existsSync(changePath) || !changeFilesResult.success) {
    return changedPackages;
  }

  const changes = changeFilesResult.stdout.split(/\n/);
  const changeFiles = changes.filter(name => path.dirname(name) === changeFolder);
  const changeFilePackageSet = new Set<string>();

  // Loop through the change files, building up a set of packages that we can skip
  changeFiles.forEach(file => {
    try {
      const changeInfo: ChangeFileInfo | ChangeInfoMultiple = fs.readJSONSync(file);

      if ('changes' in changeInfo) {
        for (const change of (changeInfo as ChangeInfoMultiple).changes) {
          changeFilePackageSet.add(change.packageName);
        }
      } else {
        changeFilePackageSet.add((changeInfo as ChangeFileInfo).packageName);
      }
    } catch (e) {
      console.warn(`Error reading or parsing change file ${file}: ${e}`);
    }
  });

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
