import type { ChangeSet, ChangeInfo, ChangeInfoMultiple } from '../types/ChangeInfo';
import { getChangePath } from '../paths';
import fs from 'fs-extra';
import path from 'path';
import type { BeachballOptions } from '../types/BeachballOptions';
import { getScopedPackages } from '../monorepo/getScopedPackages';
import { getChangesBetweenRefs } from 'workspace-tools';
import type { PackageInfos } from '../types/PackageInfo';

/**
 * Read change files, excluding any changes for packages that are:
 * - out of scope (as defined in `options.scope`)
 * - private
 * - nonexistent
 *
 * The changes will also be transformed if `options.transform.changeFiles` is provided.
 *
 * Changes from grouped change files will be flattened into individual entries in the returned array
 * (so it's possible that multiple entries will have the same filename).
 */
export function readChangeFiles(options: BeachballOptions, packageInfos: PackageInfos): ChangeSet {
  const { fromRef, command } = options;
  const scopedPackages = getScopedPackages(options, packageInfos);
  const changePath = getChangePath(options);

  if (!fs.existsSync(changePath)) {
    return [];
  }

  const allChangeFiles = fs.readdirSync(changePath);
  let filteredChangeFiles = allChangeFiles;

  if (fromRef) {
    const changeFilesSinceFromRef = getChangesBetweenRefs(
      fromRef,
      'HEAD',
      [
        '--diff-filter=d', // excluding deleted files from the diff.
        '--relative', // results will include path relative to the cwd, i.e. only file names.
      ],
      '*.json',
      changePath
    );

    filteredChangeFiles = allChangeFiles.filter(fileName => changeFilesSinceFromRef?.includes(fileName));
  }

  try {
    // sort the change files by modified time. Most recent modified file comes first.
    filteredChangeFiles.sort(
      (f1, f2) =>
        fs.statSync(path.join(changePath, f2)).mtime.getTime() - fs.statSync(path.join(changePath, f1)).mtime.getTime()
    );
  } catch (err) {
    console.warn('Failed to sort change files', err);
  }

  const changeSet: ChangeSet = [];

  // Read, transform, and filter the change files
  for (const changeFile of filteredChangeFiles) {
    const changeFilePath = path.join(changePath, changeFile);

    let changeInfo: ChangeInfo | ChangeInfoMultiple;
    try {
      changeInfo = fs.readJSONSync(changeFilePath) as ChangeInfo | ChangeInfoMultiple;
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
          `Change detected for ${warningType} package ${change.packageName}; ${resolution}: "${path.resolve(
            changePath,
            changeFile
          )}"`
        );
      }

      // Add the change to the final list if it's valid and in scope
      if (!warningType && scopedPackages.includes(change.packageName)) {
        changeSet.push({ changeFile, change });
      }
    }
  }

  return changeSet;
}
