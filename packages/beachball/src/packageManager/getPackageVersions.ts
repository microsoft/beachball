import pLimit from 'p-limit';
import type { PackageInfo } from '../types/PackageInfo';
import type { NpmOptions } from '../types/NpmOptions';
import { getNpmPackageInfo } from './getNpmPackageInfo';
import { getPackageDistTag } from './npmArgs';

/**
 * Get the current version for each package's specified tag (respecting CLI, package, and repo options).
 * Respects `options.npmReadConcurrency` for concurrency limiting.
 *
 * @returns Mapping from package name to the version for the requested tag (or undefined if no version
 * exists for that tag)
 */
export async function getPackageTagVersions(
  packageInfos: PackageInfo[],
  options: NpmOptions
): Promise<{ [pkg: string]: string }> {
  const limit = pLimit(options.npmReadConcurrency);
  const versions: { [pkg: string]: string } = {};

  const packageTags = packageInfos
    .map(pkg => ({ name: pkg.name, tag: getPackageDistTag(pkg, options) }))
    // Use !! to filter out empty strings as well
    .filter(pkg => !!pkg.tag) as { name: string; tag: string }[];

  await Promise.all(
    packageTags.map(({ name, tag }) =>
      limit(async () => {
        const info = await getNpmPackageInfo(name, tag, options);
        if (info) {
          versions[name] = info.version;
        }
      })
    )
  );

  return versions;
}

/**
 * Check whether each exact package version exists.
 * Respects `options.npmReadConcurrency` for concurrency limiting.
 * @returns Mapping from package name to whether its requested version exists
 */
export async function hasPackageVersions(
  packageVersions: Record<string, string>,
  options: NpmOptions
): Promise<Record<string, boolean>> {
  const limit = pLimit(options.npmReadConcurrency);
  const versionExists: Record<string, boolean> = {};

  await Promise.all(
    Object.entries(packageVersions).map(([pkg, version]) =>
      limit(async () => {
        versionExists[pkg] = !!(await getNpmPackageInfo(pkg, version, options));
      })
    )
  );

  return versionExists;
}
