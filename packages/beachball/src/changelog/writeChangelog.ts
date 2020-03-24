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
import { PackageChangelog } from '../types/ChangeLog';
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
    console.log('excludedChangelogPaths', { groupedChangelogPathSet, packagePath });
    if (groupedChangelogPathSet?.has(packagePath)) {
      console.log(`Skip writing change log to ${packagePath}.`);
    } else {
      writeChangelogFiles(changelogs[pkg], packagePath);
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
    [path: string]: { changelogs: PackageChangelog[]; masterChangelog: PackageChangelog };
  } = {};

  for (const pkg in changelogs) {
    const packagePath = path.dirname(packageInfos[pkg].packageJsonPath);
    const relativePath = path.relative(options.path, packagePath);
    changelogGroups.forEach(group => {
      const isInGroup = isPathIncluded(relativePath, group.include, group.exclude);
      const { changelogPath } = group;
      if (!fs.existsSync(changelogPath)) {
        console.warn(`changelog path doesn't exist: ${changelogPath}`);
        return [];
      }

      if (isInGroup) {
        if (!groupedChangelogs[changelogPath]) {
          groupedChangelogs[changelogPath] = {
            changelogs: [],
            masterChangelog: changelogs[group.masterPackageName],
          };
        }

        groupedChangelogs[changelogPath].changelogs.push(changelogs[pkg]);
      }
    });
  }

  const changelogAbsolutePaths: string[] = [];
  for (const changelogPath in groupedChangelogs) {
    const { masterChangelog, changelogs } = groupedChangelogs[changelogPath];
    const groupedChangelog = mergeChangelogs(masterChangelog, changelogs);

    writeChangelogFiles(groupedChangelog, changelogPath);
    changelogAbsolutePaths.push(path.resolve(changelogPath));
  }

  return changelogAbsolutePaths;
}

function writeChangelogFiles(changelog: PackageChangelog, changelogPath: string): void {
  if (
    changelog.comments.major ||
    changelog.comments.minor ||
    changelog.comments.patch ||
    changelog.comments.prerelease
  ) {
    const changelogFile = path.join(changelogPath, 'CHANGELOG.md');
    const previousContent = fs.existsSync(changelogFile) ? fs.readFileSync(changelogFile).toString() : '';

    const nextContent = renderChangelog(previousContent, changelog);
    fs.writeFileSync(changelogFile, nextContent);
  }
  try {
    const changelogJsonFile = path.join(changelogPath, 'CHANGELOG.json');
    const previousJson = fs.existsSync(changelogJsonFile)
      ? JSON.parse(fs.readFileSync(changelogJsonFile).toString())
      : { entries: [] };
    const nextJson = renderJsonChangelog(previousJson, changelog);
    fs.writeFileSync(changelogJsonFile, JSON.stringify(nextJson, null, 2));
  } catch (e) {
    console.warn('The CHANGELOG.json file is invalid, skipping writing to it', e);
  }
}
