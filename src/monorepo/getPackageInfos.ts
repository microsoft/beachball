import fs from 'fs-extra';
import path from 'path';
import {
  getWorkspaces as getWorkspacePackages,
  listAllTrackedFiles,
  findPackageRoot,
  findProjectRoot,
  WorkspaceInfo,
} from 'workspace-tools';
import { PackageInfos } from '../types/PackageInfo';
import { infoFromPackageJson } from './infoFromPackageJson';

/**
 * Get a mapping from package name to package info for all packages in the workspace
 * (reading from package.json files)
 */
export function getPackageInfos(cwd: string): PackageInfos {
  const projectRoot = findProjectRoot(cwd);
  const packageRoot = findPackageRoot(cwd);

  return (
    (projectRoot && getPackageInfosFromWorkspace(projectRoot)) ||
    (projectRoot && getPackageInfosFromNonWorkspaceMonorepo(projectRoot)) ||
    (packageRoot && getPackageInfosFromSingleRepo(packageRoot)) ||
    {}
  );
}

function getPackageInfosFromWorkspace(projectRoot: string): PackageInfos | undefined {
  let workspacePackages: WorkspaceInfo | undefined;
  try {
    // first try using the workspace provided packages (if available)
    workspacePackages = getWorkspacePackages(projectRoot);
  } catch (e) {
    // not a recognized workspace from workspace-tools
  }

  if (!workspacePackages?.length) {
    return;
  }

  const packageInfos: PackageInfos = {};

  for (const { path: packagePath, packageJson } of workspacePackages) {
    const packageJsonPath = path.join(packagePath, 'package.json');

    try {
      packageInfos[packageJson.name] = infoFromPackageJson(packageJson, packageJsonPath);
    } catch (e) {
      // Pass, the package.json is invalid
      console.warn(`Problem processing ${packageJsonPath}: ${e}`);
    }
  }

  return packageInfos;
}

function getPackageInfosFromNonWorkspaceMonorepo(projectRoot: string): PackageInfos | undefined {
  const packageJsonFiles = listAllTrackedFiles(['**/package.json', 'package.json'], projectRoot);
  if (!packageJsonFiles.length) {
    return;
  }

  const packageInfos: PackageInfos = {};

  let hasError = false;

  for (const packageJsonPath of packageJsonFiles) {
    try {
      const packageJsonFullPath = path.join(projectRoot, packageJsonPath);
      const packageJson = fs.readJSONSync(packageJsonFullPath);
      if (!packageInfos[packageJson.name]) {
        packageInfos[packageJson.name] = infoFromPackageJson(packageJson, packageJsonFullPath);
      } else {
        console.error(
          `ERROR: Two packages have the same name "${packageJson.name}". Please rename one of these packages:\n` +
            `- ${path.relative(projectRoot, packageInfos[packageJson.name].packageJsonPath)}\n` +
            `- ${packageJsonPath}`
        );
        // Keep going so we can log all the errors
        hasError = true;
      }
    } catch (e) {
      // Pass, the package.json is invalid
      console.warn(`Problem processing ${packageJsonPath}: ${e}`);
    }
  }

  if (hasError) {
    throw new Error('Duplicate package names found (see above for details)');
  }

  return packageInfos;
}

function getPackageInfosFromSingleRepo(packageRoot: string): PackageInfos {
  const packageInfos: PackageInfos = {};
  const packageJsonFullPath = path.resolve(packageRoot, 'package.json');
  const packageJson = fs.readJSONSync(packageJsonFullPath);
  packageInfos[packageJson.name] = infoFromPackageJson(packageJson, packageJsonFullPath);
  return packageInfos;
}
