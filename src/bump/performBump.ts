import fs from 'fs-extra';
import path from 'path';
import { unlinkChangeFiles } from '../changefile/unlinkChangeFiles';
import { writeChangelog } from '../changelog/writeChangelog';
import { BumpInfo } from '../types/BumpInfo';
import { BeachballOptions } from '../types/BeachballOptions';
import { PackageInfos, PackageJson } from '../types/PackageInfo';
import { findProjectRoot } from 'workspace-tools';
import { npm } from '../packageManager/npm';
import { packageManager } from '../packageManager/packageManager';
import { callHook } from './callHook';

export function writePackageJson(options: BeachballOptions, modifiedPackages: Set<string>, packageInfos: PackageInfos): void {
  for (const pkgName of modifiedPackages) {
    const info = packageInfos[pkgName];
    if (!fs.existsSync(info.packageJsonPath)) {
      console.warn(`Skipping ${pkgName} since package.json does not exist`);
      continue;
    }
    const packageJson: PackageJson = fs.readJSONSync(info.packageJsonPath);

    if (!info.private) {
      packageJson.version = info.version;
    }

    for (const depKind of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'] as const) {
      // updatedDeps contains all of the dependencies in the bump info since the beginning of a build job
      const updatedDepsVersions = info[depKind];
      if (updatedDepsVersions) {
        // to be cautious, only update internal && modifiedPackages, since some other dependency
        // changes could have occurred since the beginning of the build job and the next merge step
        // would overwrite those incorrectly!
        for (const [dep, updatedVersion] of Object.entries(updatedDepsVersions)) {
          if (modifiedPackages.has(dep) && packageJson[depKind]?.[dep]) {
            packageJson[depKind]![dep] = updatedVersion;
          }
        }
      }
    }

    fs.writeJSONSync(info.packageJsonPath, packageJson, { spaces: options.indentation });
  }
}

/**
 * Detects lockfile for npm, pnpm, or yarn and runs the appropriate command to update it
 */
export async function updatePackageLock(cwd: string): Promise<void> {
  const root = findProjectRoot(cwd);
  if (root && fs.existsSync(path.join(root, 'package-lock.json'))) {
    console.log('Updating package-lock.json after bumping packages');
    const res = await npm(['install', '--package-lock-only', '--ignore-scripts'], { stdio: 'inherit', cwd: root });
    if (!res.success) {
      console.warn('Updating package-lock.json failed. Continuing...');
    }
  } else if (root && fs.existsSync(path.join(root, 'pnpm-lock.yaml'))) {
    console.log('Updating pnpm-lock.yaml after bumping packages');
    const res = await packageManager('pnpm', ['install', '--lockfile-only', '--ignore-scripts'], {
      stdio: 'inherit',
      cwd: root,
    });
    if (!res.success) {
      console.warn('Updating pnpm-lock.yaml failed. Continuing...');
    }
  } else if (root && fs.existsSync(path.join(root, 'yarn.lock'))) {
    console.log('Updating yarn.lock after bumping packages');
    const version = await packageManager('yarn', ['--version'], { cwd: root });
    if (!version.success) {
      console.warn('Failed to get yarn version. Continuing...');
      return;
    }

    if (version.stdout.startsWith('1.')) {
      console.log('Yarn v1 detected, skipping update lockfile since it is not needed');
      return;
    }

    // for yarn v2+
    const res = await packageManager('yarn', ['install', '--mode', 'update-lockfile'], { stdio: 'inherit', cwd: root });
    if (!res.success) {
      console.warn('Updating yarn.lock failed. Continuing...');
    }
  }
}

/**
 * Performs the bump, writes to the file system
 *
 * deletes change files, update package.json, and changelogs
 */
export async function performBump(bumpInfo: BumpInfo, options: BeachballOptions): Promise<BumpInfo> {
  const { modifiedPackages, packageInfos, changeFileChangeInfos, dependentChangedBy, calculatedChangeTypes } = bumpInfo;

  await callHook(options.hooks?.prebump, modifiedPackages, bumpInfo.packageInfos);

  writePackageJson(options, modifiedPackages, packageInfos);
  await updatePackageLock(options.path);

  if (options.generateChangelog) {
    // Generate changelog
    await writeChangelog(options, changeFileChangeInfos, calculatedChangeTypes, dependentChangedBy, packageInfos);
  }

  if (!options.keepChangeFiles) {
    // Unlink changelogs
    unlinkChangeFiles(changeFileChangeInfos, packageInfos, options.path);
  }

  await callHook(options.hooks?.postbump, modifiedPackages, bumpInfo.packageInfos);

  // This is returned from bump() for testing
  return bumpInfo;
}
