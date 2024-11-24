import path from 'path';
import fs from 'fs-extra';
import type { PackageInfo } from '../types/PackageInfo';
import { getPackageChangelogs } from './getPackageChangelogs';
import { renderChangelog } from './renderChangelog';
import { renderJsonChangelog } from './renderJsonChangelog';
import type { BeachballOptions } from '../types/BeachballOptions';
import type { BumpInfo } from '../types/BumpInfo';
import { isPathIncluded } from '../monorepo/isPathIncluded';
import type { PackageChangelog, ChangelogJson } from '../types/ChangeLog';
import { mergeChangelogs } from './mergeChangelogs';
import { prepareChangelogPaths } from './prepareChangelogPaths';

export async function writeChangelog(
  bumpInfo: Pick<BumpInfo, 'changeFileChangeInfos' | 'calculatedChangeTypes' | 'dependentChangedBy' | 'packageInfos'>,
  options: Pick<BeachballOptions, 'changeDir' | 'changelog' | 'generateChangelog' | 'path'>
): Promise<void> {
  const { packageInfos } = bumpInfo;

  const groupedChangelogDirs = await writeGroupedChangelog(bumpInfo, options);

  // Get changelogs including dependent changes
  const changelogs = getPackageChangelogs(bumpInfo, options);

  // Write package changelogs.
  // Use a standard for loop here to prevent potentially firing off multiple network requests at once
  // (in case any custom renderers have network requests).
  for (const pkg of Object.keys(changelogs)) {
    const packagePath = path.dirname(packageInfos[pkg].packageJsonPath);
    if (!groupedChangelogDirs.includes(packagePath)) {
      await writeChangelogFiles({
        options,
        newVersionChangelog: changelogs[pkg],
        changelogAbsDir: packagePath,
        isGrouped: false,
      });
    }
  }
}

/**
 * Write grouped changelogs.
 * @returns The list of directories where grouped changelogs were written.
 */
async function writeGroupedChangelog(
  bumpInfo: Pick<BumpInfo, 'changeFileChangeInfos' | 'calculatedChangeTypes' | 'packageInfos'>,
  options: Pick<BeachballOptions, 'changeDir' | 'changelog' | 'generateChangelog' | 'path'>
): Promise<string[]> {
  const { changeFileChangeInfos, calculatedChangeTypes, packageInfos } = bumpInfo;

  // Get the changelog groups with absolute paths.
  const changelogGroups = options.changelog?.groups?.map(({ changelogPath, ...rest }) => ({
    ...rest,
    changelogAbsDir: path.resolve(options.path, changelogPath),
  }));
  if (!changelogGroups?.length) {
    return [];
  }

  // Get changelogs without dependency bump entries
  // (do NOT spread the bump info here!)
  const changelogs = getPackageChangelogs({ changeFileChangeInfos, calculatedChangeTypes, packageInfos }, options);

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
      const isInGroup = isPathIncluded({ relativePath, include: group.include, exclude: group.exclude });
      if (isInGroup) {
        groupedChangelogs[group.changelogAbsDir].changelogs.push(changelogs[pkg]);
      }
    }
  }

  // Write each grouped changelog if it's not empty
  for (const [groupAbsDir, group] of Object.entries(groupedChangelogs)) {
    const groupedChangelog = mergeChangelogs(group.changelogs, group.masterPackage);
    if (groupedChangelog) {
      await writeChangelogFiles({
        options,
        newVersionChangelog: groupedChangelog,
        changelogAbsDir: groupAbsDir,
        isGrouped: true,
      });
    }
  }

  // Return all the possible grouped changelog directories (even if there was nothing to write).
  // Otherwise if a grouped changelog location overlaps with a package changelog location, and
  // on one publish there are only dependent bump changes for that package (and no changes for
  // other packages in the group), we'd get the package changelog updates with dependent bumps
  // added to the otherwise-grouped changelog file.
  return Object.keys(groupedChangelogs);
}

async function writeChangelogFiles(params: {
  options: Pick<BeachballOptions, 'generateChangelog' | 'changelog' | 'path'>;
  newVersionChangelog: PackageChangelog;
  changelogAbsDir: string;
  isGrouped: boolean;
}): Promise<void> {
  const { options, newVersionChangelog, changelogAbsDir, isGrouped } = params;

  const changelogPaths = prepareChangelogPaths({ options, changelogAbsDir, packageName: newVersionChangelog.name });

  let previousJson: ChangelogJson | undefined;

  // Update CHANGELOG.json if appropriate
  // (changelogPaths.json will only be set if generateChangelog is true or 'json')
  if (changelogPaths.json) {
    try {
      previousJson = fs.existsSync(changelogPaths.json)
        ? (fs.readJSONSync(changelogPaths.json) as ChangelogJson)
        : undefined;
    } catch (e) {
      console.warn(`${changelogPaths.json} is invalid: ${e}`);
    }
    try {
      const nextJson = renderJsonChangelog({
        changelog: newVersionChangelog,
        previousChangelog: previousJson,
        maxVersions: options.changelog?.maxVersions,
      });
      fs.writeJSONSync(changelogPaths.json, nextJson, { spaces: 2 });
    } catch (e) {
      console.warn(`Problem writing to ${changelogPaths.json}: ${e}`);
    }
  }

  // Update CHANGELOG.md if there are changes of types besides "none"
  if (
    changelogPaths.md &&
    Object.entries(newVersionChangelog.comments).some(([type, comments]) => type !== 'none' && comments?.length)
  ) {
    const previousContent = fs.existsSync(changelogPaths.md) ? fs.readFileSync(changelogPaths.md).toString() : '';

    const newChangelog = await renderChangelog({
      previousJson,
      previousContent,
      newVersionChangelog,
      isGrouped,
      changelogOptions: options.changelog || {},
    });

    fs.writeFileSync(changelogPaths.md, newChangelog);
  }
}
