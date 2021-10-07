import { unlinkChangeFiles } from '../changefile/unlinkChangeFiles';
import { writeChangelog } from '../changelog/writeChangelog';
import fs from 'fs-extra';
import { BumpInfo } from '../types/BumpInfo';
import { BeachballOptions, HooksOptions } from '../types/BeachballOptions';
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

  await callHook('prebump', bumpInfo, options);

  writePackageJson(modifiedPackages, packageInfos);

  if (options.generateChangelog) {
    // Generate changelog
    await writeChangelog(options, changeFileChangeInfos, calculatedChangeTypes, dependentChangedBy, packageInfos);
  }

  if (!options.keepChangeFiles) {
    // Unlink changelogs
    unlinkChangeFiles(changeFileChangeInfos, packageInfos, options.path);
  }

  await callHook('postbump', bumpInfo, options);

  return bumpInfo;
}

/**
 * Calls a specified hook for each package being bumped
 */
async function callHook(hookName: keyof HooksOptions, bumpInfo: BumpInfo, options: BeachballOptions) {
  const hook = options.hooks?.[hookName];
  if (!hook) {
    return;
  }

  for (const packageName of bumpInfo.modifiedPackages) {
    const packageInfo = bumpInfo.packageInfos[packageName];

    const hookRet = hook(packageInfo.packageJsonPath, packageName, packageInfo.version);
    if (hookRet instanceof Promise) {
      await hookRet;
    }
  }
}
