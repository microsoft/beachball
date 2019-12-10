import { findPackageRoot, findGitRoot } from './paths';
import fs from 'fs';
import path from 'path';
import { listAllTrackedFiles } from './git';
import { PackageInfo } from './PackageInfo';
import { getPackageOptions } from './options';

interface BeachBallPackageConfig {
  defaultNpmTag?: string;
  disallowedChangeTypes?: string[];
}

export function getAllPackages(cwd: string): string[] {
  const infos = getPackageInfos(cwd);
  return Object.keys(infos);
}

function infoFromPackageJson(
  packageJson: {
    name: string;
    version: string;
    dependencies?: { [dep: string]: string };
    devDependencies?: { [dep: string]: string };
    peerDependencies?: { [dep: string]: string };
    beachball?: BeachBallPackageConfig;
    private?: boolean;
  },
  packageJsonPath: string
): PackageInfo {
  return {
    name: packageJson.name!,
    version: packageJson.version,
    packageJsonPath,
    dependencies: packageJson.dependencies,
    devDependencies: packageJson.devDependencies,
    peerDependencies: packageJson.peerDependencies,
    private: packageJson.private !== undefined ? packageJson.private : false,
    options: getPackageOptions(path.dirname(packageJsonPath)),
  };
}

export function getPackageInfos(cwd: string) {
  const gitRoot = findGitRoot(cwd)!;
  const trackedFiles = listAllTrackedFiles(gitRoot);
  const packageJsonFiles = trackedFiles.filter(file => path.basename(file) === 'package.json');
  const packageInfos: { [pkgName: string]: PackageInfo } = {};

  if (packageJsonFiles && packageJsonFiles.length > 0) {
    packageJsonFiles.forEach(packageJsonPath => {
      try {
        const packageJsonFullPath = path.join(gitRoot, packageJsonPath);
        const packageJson = JSON.parse(fs.readFileSync(packageJsonFullPath, 'utf-8'));
        packageInfos[packageJson.name] = infoFromPackageJson(packageJson, packageJsonFullPath);
      } catch (e) {
        // Pass, the package.json is invalid
        console.warn(`Invalid package.json file detected ${packageJsonPath}: `, e);
      }
    });
  } else {
    const packageJsonFullPath = path.join(gitRoot, findPackageRoot(cwd)!, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonFullPath, 'utf-8'));

    packageInfos[packageJson.name] = infoFromPackageJson(packageJson, packageJsonFullPath);
  }
  return packageInfos;
}

if (require.main === module) {
  console.log(getPackageInfos(__dirname));
}
