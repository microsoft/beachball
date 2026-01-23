import path from 'path';
import {
  getWorkspaceInfos,
  getPackageInfo as getWSPackageInfo,
  listAllTrackedFiles,
  findPackageRoot,
  findProjectRoot,
  type PackageInfo as WSPackageInfo,
  type PackageInfos as WSPackageInfos,
} from 'workspace-tools';
import type { PackageInfos } from '../types/PackageInfo';
import { getPackageInfosWithOptions } from '../options/getPackageInfosWithOptions';
import type { BeachballOptions, ParsedOptions } from '../types/BeachballOptions';
import { filterIgnoredFiles } from './filterIgnoredFiles';

/** Options subset used by `getPackageInfos` */
type PackageInfosOptions = Pick<ParsedOptions, 'cliOptions'> & {
  options: Pick<BeachballOptions, 'ignorePatterns' | 'path'>;
};

/**
 * Get a mapping from package name to package info for all packages in the workspace
 * (reading from package.json files).
 *
 * This looks for files relative to `cliOptions.path` (the project root).
 * The CLI options are needed so they can be properly merged with the package options
 * into `PackageInfo.packageOptions` without going back through the whole process of
 * getting CLI options.
 */
export function getPackageInfos(cliOptions: PackageInfosOptions): PackageInfos;
/** @deprecated Pass the pre-parsed options */
export function getPackageInfos(cwd: string): PackageInfos;
export function getPackageInfos(optionsOrCwd: string | PackageInfosOptions): PackageInfos {
  const parsedOptions = typeof optionsOrCwd === 'string' ? undefined : optionsOrCwd;
  const cwd = parsedOptions?.options.path || (optionsOrCwd as string);

  // If cwd comes from processed CLI options, it's already the root
  const projectRoot = typeof optionsOrCwd === 'string' ? findProjectRoot(cwd) : cwd;
  const packageRoot = findPackageRoot(cwd);

  let wsPackageInfos: WSPackageInfo[] | undefined;
  if (projectRoot) {
    wsPackageInfos =
      getPackageInfosFromMonorepoManager(projectRoot) ||
      getPackageInfosFromOtherMonorepo(projectRoot, parsedOptions?.options);
  }

  if (!wsPackageInfos?.length && packageRoot) {
    const singlePackage = getWSPackageInfo(packageRoot);
    if (singlePackage) {
      wsPackageInfos = [singlePackage];
    }
  }

  if (wsPackageInfos) {
    return parsedOptions
      ? getPackageInfosWithOptions(wsPackageInfos, parsedOptions.cliOptions)
      : // eslint-disable-next-line etc/no-deprecated
        getPackageInfosWithOptions(wsPackageInfos);
  }
  return {};
}

/** Try to find packages from a monorepo manager */
function getPackageInfosFromMonorepoManager(projectRoot: string): WSPackageInfo[] | undefined {
  const wsPackageInfos = getWorkspaceInfos(projectRoot)?.map(({ packageJson }) => packageJson);
  return wsPackageInfos?.length ? wsPackageInfos : undefined;
}

/** Glob for `package.json` files under the current folder */
function getPackageInfosFromOtherMonorepo(
  projectRoot: string,
  options: Pick<BeachballOptions, 'ignorePatterns'> | undefined
): WSPackageInfo[] | undefined {
  const allPackageJsons = listAllTrackedFiles({
    // Include both the root package.json and nested ones. This preserves existing behavior, which
    // turns out to be important for the beachball repo itself. (The root package.json is the real
    // package, but there's also a separately-managed "docs" folder with its own package.json. Any
    // extra folders like that should be marked as private: true to be ignored.)
    patterns: ['**/package.json', 'package.json'],
    cwd: projectRoot,
    throwOnError: false, // mainly happens in tests if it's not a git repo
  });

  const packageJsonFiles = filterIgnoredFiles({
    filePaths: allPackageJsons,
    ignorePatterns: options?.ignorePatterns,
  });

  if (!packageJsonFiles.length) {
    return;
  }

  const wsPackageInfos: WSPackageInfos = {};
  let hasError = false;

  for (const file of packageJsonFiles) {
    const packageJson = getWSPackageInfo(path.join(projectRoot, path.dirname(file)));
    if (!packageJson) continue;

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
  }

  if (hasError) {
    throw new Error(
      'Duplicate package names found (see above for details).\n' +
        "If you're getting this error due to test fixtures or other unexpected files, add the " +
        'paths to ignorePatterns in the beachball config.'
    );
  }

  return Object.values(wsPackageInfos);
}
