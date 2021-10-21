import { unlinkChangeFiles } from '../changefile/unlinkChangeFiles';
import { writeChangelog } from '../changelog/writeChangelog';
import fs from 'fs-extra';
import { BumpInfo } from '../types/BumpInfo';
import { BeachballOptions } from '../types/BeachballOptions';
import { PackageDeps, PackageInfos } from '../types/PackageInfo';

export function writePackageJson(modifiedPackages: Set<string>, packageInfos: PackageInfos) {
  for (const pkgName of modifiedPackages) {
    const info = packageInfos[pkgName];
    const packageJson = fs.readJSONSync(info.packageJsonPath);

    packageJson.version = info.version;

    ['dependencies', 'devDependencies', 'peerDependencies'].forEach(depKind => {
      // updatedDeps contains all of the dependencies in the bump info since the beginning of a build job
      const updatedDepsVersions: PackageDeps | undefined = (info as any)[depKind];
      if (updatedDepsVersions) {
        // to be cautious, only update internal && modifiedPackages, since some other dependency
        // changes could have occurred since the beginning of the build job and the next merge step
        // would overwrite those incorrectly!
        const modifiedDeps = Object.keys(updatedDepsVersions).filter(dep => modifiedPackages.has(dep));

        for (const dep of modifiedDeps) {
          if (packageJson[depKind] && packageJson[depKind][dep]) {
            packageJson[depKind][dep] = updatedDepsVersions[dep];
          }
        }
      }
    });

    fs.writeJSONSync(info.packageJsonPath, packageJson, { spaces: 2 });
  }
}

/**
 * Performs the bump, writes to the file system
 *
 * deletes change files, update package.json, and changelogs
 */
export async function performBump(bumpInfo: BumpInfo, options: BeachballOptions) {
  const { modifiedPackages, packageInfos, changeFileChangeInfos, dependentChangedBy, calculatedChangeTypes } = bumpInfo;

  writePackageJson(modifiedPackages, packageInfos);

  // Update bump info with the package.json files that were edited for the modified packages
  modifiedPackages.forEach(modifiedPackage => bumpInfo.modifiedFiles.add(packageInfos[modifiedPackage].packageJsonPath));

  if (options.generateChangelog) {
    // Generate changelog
    const modifiedChangelogFiles = await writeChangelog(options, changeFileChangeInfos, calculatedChangeTypes, dependentChangedBy, packageInfos);

    // Update bump info with the changelog files that were generated
    modifiedChangelogFiles.forEach(modifiedChangelogFile => bumpInfo.modifiedFiles.add(modifiedChangelogFile));
  }

  if (!options.keepChangeFiles) {
    // Unlink changelogs
    const unlinkedFilesAndChangedDirs = unlinkChangeFiles(changeFileChangeInfos, packageInfos, options.path);

    // Update bump info with the change files that were unlinked/removed. Also add the /change dir if there are no change files left in the dir
    unlinkedFilesAndChangedDirs.forEach(unlinkedChangeFile => bumpInfo.modifiedFiles.add(unlinkedChangeFile));
  }

  return bumpInfo;
}
