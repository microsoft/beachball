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
import type { CliOptions } from '../types/BeachballOptions';
import { readJson } from '../object/readJson';

/** CLI options subset used by `getPackageInfos` */
export type PackageInfosCliOptions = Partial<CliOptions> & Pick<CliOptions, 'path'>;

/**
 * Get a mapping from package name to package info for all packages in the workspace
 * (reading from package.json files).
 *
 * This looks for files relative to `cliOptions.path` (the project root).
 * The CLI options are needed so they can be properly merged with the package options
 * into `PackageInfo.packageOptions` without going back through the whole process of
 * getting CLI options.
 */
export function getPackageInfos(cliOptions: PackageInfosCliOptions): PackageInfos;
/** @deprecated Pass the pre-parsed options */
export function getPackageInfos(cwd: string): PackageInfos;
export function getPackageInfos(optionsOrCwd: string | PackageInfosCliOptions): PackageInfos {
  const cwd = typeof optionsOrCwd === 'string' ? optionsOrCwd : optionsOrCwd.path;

  // If cwd comes from processed CLI options, it's already the root
  const projectRoot = typeof optionsOrCwd === 'string' ? findProjectRoot(cwd) : cwd;
  const packageRoot = findPackageRoot(cwd);

  let wsPackageInfos: WSPackageInfo[] | undefined;
  if (projectRoot) {
    wsPackageInfos = getPackageInfosFromWorkspace(projectRoot) || getPackageInfosFromNonWorkspaceMonorepo(projectRoot);
  }
  if (!wsPackageInfos && packageRoot) {
    wsPackageInfos = [readWsPackageInfo(path.join(packageRoot, 'package.json'))];
  }

  if (wsPackageInfos) {
    return typeof optionsOrCwd === 'string'
      ? // eslint-disable-next-line beachball/no-deprecated
        getPackageInfosWithOptions(wsPackageInfos)
      : getPackageInfosWithOptions(wsPackageInfos, optionsOrCwd);
  }
  return {};
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
  const packageJsonFiles = listAllTrackedFiles({
    // Include both the root package.json and nested ones. This preserves existing behavior, which
    // turns out to be important for the beachball repo itself. (The root package.json is the real
    // package, but there's also a separately-managed "docs" folder with its own package.json. Any
    // extra folders like that should be marked as private: true to be ignored.)
    patterns: ['**/package.json', 'package.json'],
    cwd: projectRoot,
    throwOnError: false, // mainly happens in tests if it's not a git repo
  });
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
    ...readJson<WSPackageInfo>(packageJsonPath),
    packageJsonPath,
  };
}
