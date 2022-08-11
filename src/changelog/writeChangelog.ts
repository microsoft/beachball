import path from 'path';
import fs from 'fs-extra';
import _ from 'lodash';
import { PackageInfo } from '../types/PackageInfo';
import { getPackageChangelogs } from './getPackageChangelogs';
import { renderChangelog } from './renderChangelog';
import { renderJsonChangelog } from './renderJsonChangelog';
import { BeachballOptions } from '../types/BeachballOptions';
import { BumpInfo } from '../types/BumpInfo';
import { isPathIncluded } from '../monorepo/isPathIncluded';
import { PackageChangelog, ChangelogJson } from '../types/ChangeLog';
import { mergeChangelogs } from './mergeChangelogs';
import { ChangeSet } from '../types/ChangeInfo';

export async function writeChangelog(
  options: BeachballOptions,
  changeFileChangeInfos: ChangeSet,
  calculatedChangeTypes: BumpInfo['calculatedChangeTypes'],
  dependentChangedBy: BumpInfo['dependentChangedBy'],
  packageInfos: {
    [pkg: string]: PackageInfo;
  }
): Promise<void> {
  const groupedChangelogPaths = await writeGroupedChangelog(
    options,
    changeFileChangeInfos,
    calculatedChangeTypes,
    packageInfos
  );
  const groupedChangelogPathSet = new Set(groupedChangelogPaths);

  const changelogs = getPackageChangelogs(
    changeFileChangeInfos,
    calculatedChangeTypes,
    dependentChangedBy,
    packageInfos,
    options.path
  );
  // Use a standard for loop here to prevent potentially firing off multiple network requests at once
  // (in case any custom renderers have network requests)
  for (const pkg of Object.keys(changelogs)) {
    const packagePath = path.dirname(packageInfos[pkg].packageJsonPath);
    if (groupedChangelogPathSet?.has(packagePath)) {
      console.log(`Changelog for ${pkg} has been written as a group here: ${packagePath}`);
    } else {
      await writeChangelogFiles(options, changelogs[pkg], packagePath, false);
    }
  }
}

async function writeGroupedChangelog(
  options: BeachballOptions,
  changeFileChangeInfos: ChangeSet,
  calculatedChangeTypes: BumpInfo['calculatedChangeTypes'],
  packageInfos: {
    [pkg: string]: PackageInfo;
  }
): Promise<string[]> {
  if (!options.changelog) {
    return [];
  }

  const { groups: changelogGroups } = options.changelog;
  if (!changelogGroups || changelogGroups.length < 1) {
    return [];
  }

  // Grouped changelogs should not contain dependency bump entries
  const changelogs = getPackageChangelogs(changeFileChangeInfos, calculatedChangeTypes, {}, packageInfos, options.path);
  const groupedChangelogs: {
    [path: string]: {
      changelogs: PackageChangelog[];
      masterPackage: PackageInfo;
    };
  } = {};

  for (const pkg in changelogs) {
    const packagePath = path.dirname(packageInfos[pkg].packageJsonPath);
    const relativePath = path.relative(options.path, packagePath);
    for (const group of changelogGroups) {
      const { changelogPath, masterPackageName } = group;
      const masterPackage = packageInfos[masterPackageName];
      if (!masterPackage) {
        console.warn(`master package ${masterPackageName} does not exist.`);
        continue;
      }
      if (!fs.existsSync(changelogPath)) {
        console.warn(`changelog path ${changelogPath} does not exist.`);
        continue;
      }

      const isInGroup = isPathIncluded(relativePath, group.include, group.exclude);
      if (isInGroup) {
        if (!groupedChangelogs[changelogPath]) {
          groupedChangelogs[changelogPath] = {
            changelogs: [],
            masterPackage,
          };
        }

        groupedChangelogs[changelogPath].changelogs.push(changelogs[pkg]);
      }
    }
  }

  const changelogAbsolutePaths: string[] = [];
  for (const changelogPath in groupedChangelogs) {
    const { masterPackage, changelogs } = groupedChangelogs[changelogPath];
    const groupedChangelog = mergeChangelogs(changelogs, masterPackage);
    if (groupedChangelog) {
      await writeChangelogFiles(options, groupedChangelog, changelogPath, true);
      changelogAbsolutePaths.push(path.resolve(changelogPath));
    }
  }

  return changelogAbsolutePaths;
}

async function writeChangelogFiles(
  options: BeachballOptions,
  newVersionChangelog: PackageChangelog,
  changelogPath: string,
  isGrouped: boolean
): Promise<void> {
  let previousJson: ChangelogJson | undefined;

  // Update CHANGELOG.json
  const changelogJsonFile = path.join(changelogPath, 'CHANGELOG.json');
  try {
    previousJson = fs.existsSync(changelogJsonFile) ? fs.readJSONSync(changelogJsonFile) : undefined;
  } catch (e) {
    console.warn('CHANGELOG.json is invalid:', e);
  }
  try {
    const nextJson = renderJsonChangelog(newVersionChangelog, previousJson);
    fs.writeJSONSync(changelogJsonFile, nextJson, { spaces: 2 });
  } catch (e) {
    console.warn('Problem writing to CHANGELOG.json:', e);
  }

  // Update CHANGELOG.md
  if (
    newVersionChangelog.comments.major ||
    newVersionChangelog.comments.minor ||
    newVersionChangelog.comments.patch ||
    newVersionChangelog.comments.prerelease
  ) {
    const changelogFile = path.join(changelogPath, 'CHANGELOG.md');
    const previousContent = fs.existsSync(changelogFile) ? fs.readFileSync(changelogFile).toString() : '';

    const newChangelog = await renderChangelog({
      previousJson,
      previousContent,
      newVersionChangelog,
      isGrouped,
      changelogOptions: options.changelog || {},
    });

    fs.writeFileSync(changelogFile, newChangelog);
  }
}
