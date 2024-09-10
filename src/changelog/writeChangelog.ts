import path from 'path';
import fs from 'fs-extra';
import _ from 'lodash';
import { PackageInfo, PackageInfos } from '../types/PackageInfo';
import { getPackageChangelogs } from './getPackageChangelogs';
import { renderChangelog } from './renderChangelog';
import { renderJsonChangelog } from './renderJsonChangelog';
import { BeachballOptions } from '../types/BeachballOptions';
import { BumpInfo } from '../types/BumpInfo';
import { isPathIncluded } from '../monorepo/isPathIncluded';
import { PackageChangelog, ChangelogJson } from '../types/ChangeLog';
import { mergeChangelogs } from './mergeChangelogs';
import { ChangeSet } from '../types/ChangeInfo';
import { DeepReadonly } from '../types/DeepReadonly';

export async function writeChangelog(
  bumpInfo: Pick<BumpInfo, 'changeFileChangeInfos' | 'calculatedChangeTypes' | 'dependentChangedBy' | 'packageInfos'>,
  options: BeachballOptions
): Promise<void> {
  const { changeFileChangeInfos, calculatedChangeTypes, dependentChangedBy, packageInfos } = bumpInfo;

  const groupedChangelogDirs = await writeGroupedChangelog(
    options,
    changeFileChangeInfos,
    calculatedChangeTypes,
    packageInfos
  );

  const changelogs = getPackageChangelogs({
    changeFileChangeInfos,
    calculatedChangeTypes,
    dependentChangedBy,
    packageInfos,
    options,
  });

  // Write package changelogs.
  // Use a standard for loop here to prevent potentially firing off multiple network requests at once
  // (in case any custom renderers have network requests).
  for (const pkg of Object.keys(changelogs)) {
    const packagePath = path.dirname(packageInfos[pkg].packageJsonPath);
    if (!groupedChangelogDirs.includes(packagePath)) {
      await writeChangelogFiles(options, changelogs[pkg], packagePath, false);
    }
  }
}

/**
 * Write grouped changelogs.
 * @returns The list of directories where grouped changelogs were written.
 */
async function writeGroupedChangelog(
  options: BeachballOptions,
  changeFileChangeInfos: DeepReadonly<ChangeSet>,
  calculatedChangeTypes: BumpInfo['calculatedChangeTypes'],
  packageInfos: PackageInfos
): Promise<string[]> {
  // Get the changelog groups with absolute paths.
  const changelogGroups = options.changelog?.groups?.map(({ changelogPath, ...rest }) => ({
    ...rest,
    changelogAbsDir: path.resolve(options.path, changelogPath),
  }));
  if (!changelogGroups?.length) {
    return [];
  }

  // Get changelogs without dependency bump entries
  const changelogs = getPackageChangelogs({
    changeFileChangeInfos,
    calculatedChangeTypes,
    packageInfos,
    options,
  });

  const groupedChangelogs: {
    [changelogAbsDir: string]: { changelogs: PackageChangelog[]; masterPackage: PackageInfo };
  } = {};

  // Validate groups and initialize groupedChangelogs
  for (const { masterPackageName, changelogAbsDir } of changelogGroups) {
    const masterPackage = packageInfos[masterPackageName];
    if (!masterPackage) {
      console.warn(`master package ${masterPackageName} does not exist.`);
      continue;
    }
    if (!fs.existsSync(changelogAbsDir)) {
      console.warn(`changelog path ${changelogAbsDir} does not exist.`);
      continue;
    }
    groupedChangelogs[changelogAbsDir] = { masterPackage, changelogs: [] };
  }

  // Put changelogs into groups
  for (const pkg of Object.keys(changelogs)) {
    const packagePath = path.dirname(packageInfos[pkg].packageJsonPath);
    const relativePath = path.relative(options.path, packagePath);

    for (const group of changelogGroups) {
      const isInGroup = isPathIncluded(relativePath, group.include, group.exclude);
      if (isInGroup) {
        groupedChangelogs[group.changelogAbsDir].changelogs.push(changelogs[pkg]);
      }
    }
  }

  // Write each grouped changelog if it's not empty
  for (const [changelogAbsDir, { masterPackage, changelogs }] of Object.entries(groupedChangelogs)) {
    const groupedChangelog = mergeChangelogs(changelogs, masterPackage);
    if (groupedChangelog) {
      await writeChangelogFiles(options, groupedChangelog, changelogAbsDir, true);
    }
  }

  // Return all the possible grouped changelog directories (even if there was nothing to write).
  // Otherwise if a grouped changelog location overlaps with a package changelog location, and
  // on one publish there are only dependent bump changes for that package (and no changes for
  // other packages in the group), we'd get the package changelog updates with dependent bumps
  // added to the otherwise-grouped changelog file.
  return Object.keys(groupedChangelogs);
}

async function writeChangelogFiles(
  options: BeachballOptions,
  newVersionChangelog: PackageChangelog,
  changelogPath: string,
  isGrouped: boolean
): Promise<void> {
  let previousJson: ChangelogJson | undefined;

  // Update CHANGELOG.json
  if (options.generateChangelog === true || options.generateChangelog === 'json') {
    const changelogJsonFile = path.join(changelogPath, 'CHANGELOG.json');
    try {
      previousJson = fs.existsSync(changelogJsonFile) ? fs.readJSONSync(changelogJsonFile) : undefined;
    } catch (e) {
      console.warn(`${changelogJsonFile} is invalid: ${e}`);
    }
    try {
      const nextJson = renderJsonChangelog(newVersionChangelog, previousJson);
      fs.writeJSONSync(changelogJsonFile, nextJson, { spaces: 2 });
    } catch (e) {
      console.warn(`Problem writing to ${changelogJsonFile}: ${e}`);
    }
  }

  // Update CHANGELOG.md if there are changes of types besides "none"
  if (
    (options.generateChangelog === true || options.generateChangelog === 'md') &&
    Object.entries(newVersionChangelog.comments).some(([type, comments]) => type !== 'none' && comments?.length)
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
