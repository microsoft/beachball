import fs from 'fs-extra';
import path from 'path';
import { unlinkChangeFiles } from '../changefile/unlinkChangeFiles';
import { writeChangelog } from '../changelog/writeChangelog';
import { BumpInfo } from '../types/BumpInfo';
import { BeachballOptions, HooksOptions } from '../types/BeachballOptions';
import { PackageDeps, PackageInfos } from '../types/PackageInfo';
import { findProjectRoot } from 'workspace-tools';
import { npm } from '../packageManager/npm';

export function writePackageJson(modifiedPackages: Set<string>, packageInfos: PackageInfos) {
  for (const pkgName of modifiedPackages) {
    const info = packageInfos[pkgName];
    if (!fs.existsSync(info.packageJsonPath)) {
      console.warn(`Skipping ${pkgName} since package.json does not exist`);
      continue;
    }
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
 * If `package-lock.json` exists, runs `npm install --package-lock-only` to update it.
 */
export function updatePackageLock(cwd: string) {
  const root = findProjectRoot(cwd);
  if (root && fs.existsSync(path.join(root, 'package-lock.json'))) {
    console.log('Updating package-lock.json after bumping packages');
    const res = npm(['install', '--package-lock-only', '--ignore-scripts'], { stdio: 'inherit' });
    if (!res.success) {
      console.warn('Updating package-lock.json failed. Continuing...');
    }
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
  updatePackageLock(options.path);

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

    const hookRet = hook(path.dirname(packageInfo.packageJsonPath), packageName, packageInfo.version);
    if (hookRet instanceof Promise) {
      await hookRet;
    }
  }
}
