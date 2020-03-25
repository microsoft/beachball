import path from 'path';
import fs from 'fs';
import _ from 'lodash';
import { ChangeSet } from '../types/ChangeInfo';
import { PackageInfo } from '../types/PackageInfo';
import { getPackageChangelogs } from './getPackageChangelogs';
import { renderChangelog } from './renderChangelog';
import { renderJsonChangelog } from './renderJsonChangelog';
import { BeachballOptions } from '../types/BeachballOptions';
import { isPathIncluded } from '../monorepo/utils';
import { PackageChangelog, ChangelogJsonEntry } from '../types/ChangeLog';
import { mergeChangelogs } from './mergeChangelogs';

export function writeChangelog(
  options: BeachballOptions,
  changeSet: ChangeSet,
  packageInfos: {
    [pkg: string]: PackageInfo;
  }
): void {
  const groupedChangelogPaths = writeGroupedChangelog(options, changeSet, packageInfos);
  const groupedChangelogPathSet = new Set(groupedChangelogPaths);

  const changelogs = getPackageChangelogs(changeSet, packageInfos);
  Object.keys(changelogs).forEach(pkg => {
    const packagePath = path.dirname(packageInfos[pkg].packageJsonPath);
    if (groupedChangelogPathSet?.has(packagePath)) {
      console.log(`Changelog for ${pkg} has been written as a group here: ${packagePath}`);
    } else {
      writeChangelogFiles(options, changelogs[pkg], packagePath, false);
    }
  });
}

function writeGroupedChangelog(
  options: BeachballOptions,
  changeSet: ChangeSet,
  packageInfos: {
    [pkg: string]: PackageInfo;
  }
): string[] {
  if (!options.changelog) {
    return [];
  }

  const { groups: changelogGroups } = options.changelog;
  if (!changelogGroups || changelogGroups.length < 1) {
    return [];
  }

  const changelogs = getPackageChangelogs(changeSet, packageInfos);
  const groupedChangelogs: {
    [path: string]: { changelogs: PackageChangelog[]; masterPackage: PackageInfo };
  } = {};

  for (const pkg in changelogs) {
    const packagePath = path.dirname(packageInfos[pkg].packageJsonPath);
    const relativePath = path.relative(options.path, packagePath);
    for (const group of changelogGroups) {
      const { changelogPath, masterPackageName } = group;
      const masterPackage = packageInfos[masterPackageName];
      if (!masterPackage) {
        console.warn(`master pakcage ${masterPackageName} does not exist.`);
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
      writeChangelogFiles(options, groupedChangelog, changelogPath, true);
      changelogAbsolutePaths.push(path.resolve(changelogPath));
    }
  }

  return changelogAbsolutePaths;
}

function writeChangelogFiles(
  options: BeachballOptions,
  changelog: PackageChangelog,
  changelogPath: string,
  isGroupedChangelog: boolean
): void {
  let previousJsonEntry: ChangelogJsonEntry | undefined;
  try {
    const changelogJsonFile = path.join(changelogPath, 'CHANGELOG.json');
    const previousJson = fs.existsSync(changelogJsonFile)
      ? JSON.parse(fs.readFileSync(changelogJsonFile).toString())
      : { entries: [] };
    previousJsonEntry = previousJson.entries[0];
    const nextJson = renderJsonChangelog(previousJson, changelog);
    fs.writeFileSync(changelogJsonFile, JSON.stringify(nextJson, null, 2));
  } catch (e) {
    console.warn('The CHANGELOG.json file is invalid, skipping writing to it', e);
  }

  if (
    changelog.comments.major ||
    changelog.comments.minor ||
    changelog.comments.patch ||
    changelog.comments.prerelease
  ) {
    const changelogFile = path.join(changelogPath, 'CHANGELOG.md');
    const previousContent = fs.existsSync(changelogFile) ? fs.readFileSync(changelogFile).toString() : '';

    const nextContent = renderChangelog({
      previousContent,
      changelog,
      isGroupedChangelog,
      previousChangelogEntry: previousJsonEntry,
      github: options.github,
    });
    fs.writeFileSync(changelogFile, nextContent);
  }
}
