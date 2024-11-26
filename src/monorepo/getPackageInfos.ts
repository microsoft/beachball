import fs from 'fs-extra';
import path from 'path';
import {
  getWorkspaces as getWorkspacePackages,
  listAllTrackedFiles,
  findPackageRoot,
  findProjectRoot,
  type PackageInfo as WSPackageInfo,
  type PackageInfos as WSPackageInfos,
} from 'workspace-tools';
import type { PackageInfos } from '../types/PackageInfo';
import { getPackageInfosWithOptions } from '../options/getPackageInfosWithOptions';

/**
 * Get a mapping from package name to package info for all packages in the workspace
 * (reading from package.json files)
 */
export function getPackageInfos(cwd: string): PackageInfos {
  const projectRoot = findProjectRoot(cwd);
  const packageRoot = findPackageRoot(cwd);

  let wsPackageInfos: WSPackageInfo[] | undefined;
  if (projectRoot) {
    wsPackageInfos = getPackageInfosFromWorkspace(projectRoot) || getPackageInfosFromNonWorkspaceMonorepo(projectRoot);
  }
  if (!wsPackageInfos && packageRoot) {
    wsPackageInfos = [readWsPackageInfo(path.join(packageRoot, 'package.json'))];
  }

  return wsPackageInfos ? getPackageInfosWithOptions(wsPackageInfos) : {};
}

function getPackageInfosFromWorkspace(projectRoot: string): WSPackageInfo[] | undefined {
  let workspacePackages: WSPackageInfo[] | undefined;
  try {
    // first try using the workspace provided packages (if available)
    workspacePackages = getWorkspacePackages(projectRoot).map(pkg => pkg.packageJson);
  } catch {
    // not a recognized workspace from workspace-tools
  }

  return workspacePackages?.length ? workspacePackages : undefined;
}

function getPackageInfosFromNonWorkspaceMonorepo(projectRoot: string): WSPackageInfo[] | undefined {
  const packageJsonFiles = listAllTrackedFiles(['**/package.json', 'package.json'], projectRoot);
  if (!packageJsonFiles.length) {
    return;
  }

  const wsPackageInfos: WSPackageInfos = {};
  let hasError = false;

  for (const file of packageJsonFiles) {
    try {
      const packageJson = readWsPackageInfo(path.join(projectRoot, file));

      if (!wsPackageInfos[packageJson.name]) {
        wsPackageInfos[packageJson.name] = packageJson;
      } else {
        console.error(
          `ERROR: Two packages have the same name "${packageJson.name}". Please rename one of these packages:\n` +
            `- ${path.relative(projectRoot, wsPackageInfos[packageJson.name].packageJsonPath)}\n` +
            `- ${path.relative(projectRoot, packageJson.packageJsonPath)}`
        );
        // Keep going so we can log all the errors
        hasError = true;
      }
    } catch (e) {
      // Pass, the package.json is invalid
      console.warn(`Problem processing ${file}: ${e}`);
    }
  }

  if (hasError) {
    throw new Error('Duplicate package names found (see above for details)');
  }

  return Object.values(wsPackageInfos);
}

function readWsPackageInfo(packageJsonPath: string): WSPackageInfo {
  return {
    // this is actually the properties of WSPackageInfo except the packageJsonPath, but using omit
    // messes things up due to the index signature...
    ...(fs.readJSONSync(packageJsonPath) as WSPackageInfo),
    packageJsonPath,
  };
}
