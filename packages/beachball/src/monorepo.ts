import { findPackageRoot, findGitRoot } from './paths';
import fs from 'fs';
import path from 'path';
import { listAllTrackedFiles } from './git';
import { PackageInfo } from './PackageInfo';

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
    disallowedChangeTypes:
      packageJson.beachball && packageJson.beachball.disallowedChangeTypes
        ? packageJson.beachball.disallowedChangeTypes
        : [],
    defaultNpmTag:
      packageJson.beachball && packageJson.beachball.defaultNpmTag ? packageJson.beachball.defaultNpmTag : 'latest',
    private: packageJson.private !== undefined ? packageJson.private : false,
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
