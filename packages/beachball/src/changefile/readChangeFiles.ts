import type { ChangeSet, ChangeInfo, ChangeInfoMultiple, ChangeType } from '../types/ChangeInfo';
import { LegacyChangeTypeMap } from './changeTypes';
import { getChangePath } from '../paths';
import fs from 'fs';
import path from 'path';
import type { BeachballOptions } from '../types/BeachballOptions';
import { getChangesBetweenRefs } from 'workspace-tools';
import type { PackageInfos, ScopedPackages } from '../types/PackageInfo';
import { readJson } from '../object/readJson';

/**
 * Read change files, excluding any changes for packages that are:
 * - out of scope (as defined in `options.scope`)
 * - private
 * - nonexistent
 * - added before `options.fromRef` if set
 *
 * The changes will also be transformed if `options.transform.changeFiles` is provided.
 *
 * Changes from grouped change files will be flattened into individual entries in the returned array
 * (so it's possible that multiple entries will have the same filename).
 */
export function readChangeFiles(
  options: BeachballOptions,
  packageInfos: PackageInfos,
  scopedPackages: ScopedPackages
): ChangeSet {
  const { fromRef, command } = options;
  const changePath = getChangePath(options);

  if (!fs.existsSync(changePath)) {
    return [];
  }

  const allChangeFiles = fs.readdirSync(changePath);
  let filteredChangeFiles = allChangeFiles;

  if (fromRef) {
    const changeFilesSinceFromRef = getChangesBetweenRefs({
      fromRef,
      toRef: 'HEAD',
      options: [
        '--diff-filter=d', // excluding deleted files from the diff.
        '--relative', // results will include path relative to the cwd, i.e. only file names.
      ],
      pattern: '*.json',
      cwd: changePath,
    });

    filteredChangeFiles = allChangeFiles.filter(fileName => changeFilesSinceFromRef?.includes(fileName));
  }

  // sort the change files by modified time. Most recent modified file comes first.
  filteredChangeFiles.sort(
    (f1, f2) => getMtime({ changePath, changeFile: f2 }) - getMtime({ changePath, changeFile: f1 })
  );

  const changeSet: ChangeSet = [];

  // Read, transform, and filter the change files
  for (const changeFile of filteredChangeFiles) {
    const changeFilePath = path.join(changePath, changeFile);

    let changeInfo: ChangeInfo | ChangeInfoMultiple;
    try {
      changeInfo = readJson<ChangeInfo | ChangeInfoMultiple>(changeFilePath);
      if (!(changeInfo as ChangeInfo).packageName && !(changeInfo as ChangeInfoMultiple).changes) {
        console.warn(`${changeFilePath} does not appear to be a change file`);
        continue;
      }
    } catch (e) {
      console.warn(`Error reading or parsing change file ${changeFilePath}: ${e}`);
      continue;
    }

    // Transform the change files, if the option is provided
    if (options.transform?.changeFiles) {
      try {
        changeInfo = options.transform?.changeFiles(changeInfo, changeFilePath, {
          command,
        });
      } catch (e) {
        console.warn(`Error transforming ${changeFilePath}: ${e}`);
        continue;
      }
    }

    const changes = (changeInfo as ChangeInfoMultiple).changes || [changeInfo as ChangeInfo];

    // Filter the changes from this file
    for (const change of changes) {
      // Migrate legacy change types from older Beachball versions.
      // - `pre*` => the stripped equivalent (with a warning)
      // - `prerelease` => hard error; the user must recreate the change file
      if ((change.type as string) === 'prerelease') {
        throw new Error(
          `Change file ${changeFilePath} uses change type "prerelease", which is no longer supported. ` +
            `Delete this change file and recreate it with a "patch", "minor", "major", or "none" change type. ` +
            `To publish a prerelease version, use the "beachball prerelease" command instead.`
        );
      }
      const legacyReplacement = LegacyChangeTypeMap[change.type as keyof typeof LegacyChangeTypeMap];
      if (legacyReplacement) {
        console.warn(
          `Change file ${changeFilePath} uses legacy change type "${change.type}", which has been renamed to "${legacyReplacement}". ` +
            `The change file will be processed as "${legacyReplacement}". To remove this warning, update the file (or recreate it).`
        );
        change.type = legacyReplacement;
      }
      // Same migration for the dependentChangeType field
      if ((change.dependentChangeType as string) === 'prerelease') {
        throw new Error(
          `Change file ${changeFilePath} uses dependentChangeType "prerelease", which is no longer supported. ` +
            `Delete this change file and recreate it with a "patch", "minor", "major", or "none" dependentChangeType.`
        );
      }
      const legacyDepReplacement = LegacyChangeTypeMap[change.dependentChangeType as keyof typeof LegacyChangeTypeMap];
      if (legacyDepReplacement) {
        console.warn(
          `Change file ${changeFilePath} uses legacy dependentChangeType "${change.dependentChangeType}", which has been renamed to "${legacyDepReplacement}". ` +
            `The change file will be processed as "${legacyDepReplacement}". To remove this warning, update the file (or recreate it).`
        );
        change.dependentChangeType = legacyDepReplacement as ChangeType;
      }

      // Log warnings about change entries for nonexistent and private packages.
      // (This may happen if a package is renamed or its private flag is changed.)
      const warningType = !packageInfos[change.packageName]
        ? 'nonexistent'
        : packageInfos[change.packageName].private
        ? 'private'
        : undefined;
      if (warningType) {
        const resolution = options.groupChanges ? 'remove the entry from this file' : 'delete this file';
        console.warn(
          `Change detected for ${warningType} package ${change.packageName}; ${resolution}: ${changeFilePath}`
        );
      }

      // Add the change to the final list if it's valid and in scope
      if (!warningType && scopedPackages.has(change.packageName)) {
        changeSet.push({ changeFile, change });
      }
    }
  }

  return changeSet;
}

const mtimeCache: Record<string, number> = {};

/**
 * Get a file's modification time with caching. (Usually the caching won't matter, but it might
 * in large repos with many change files.)
 */
function getMtime(params: { changePath: string; changeFile: string }) {
  const cached = mtimeCache[params.changeFile];
  if (cached !== undefined) {
    return cached;
  }

  try {
    const mtime = fs.statSync(path.join(params.changePath, params.changeFile)).mtime.getTime();
    mtimeCache[params.changeFile] = mtime;
    return mtime;
  } catch (err) {
    mtimeCache[params.changeFile] = 0;
    return 0;
  }
}
