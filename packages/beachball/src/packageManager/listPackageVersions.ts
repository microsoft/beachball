import pLimit from 'p-limit';
import type { PackageInfo } from '../types/PackageInfo';
import type { NpmOptions } from '../types/NpmOptions';
import { getNpmPackageInfo } from './getNpmPackageInfo';
import { getPackageOption } from '../options/getPackageOption';

/**
 * List versions matching the appropriate tag for each package (based on combined CLI, package, and repo options).
 * Respects `options.npmReadConcurrency` for concurrency limiting.
 */
export async function listPackageVersionsByTag(
  packageInfos: PackageInfo[],
  options: NpmOptions
): Promise<{ [pkg: string]: string }> {
  const limit = pLimit(options.npmReadConcurrency);
  const versions: { [pkg: string]: string } = {};

  const packageTags = packageInfos
    .map(pkg => ({
      name: pkg.name,
      // TODO: what was tag=null in packageOptions originally supposed to do?
      // (most recent logic prior to this also used || which ignores null)
      tag: getPackageOption('tag', pkg, options) || getPackageOption('defaultNpmTag', pkg, options),
    }))
    // Use !! to filter out empty strings as well
    .filter(pkg => !!pkg.tag) as { name: string; tag: string }[];

  await Promise.all(
    packageTags.map(({ name, tag }) =>
      limit(async () => {
        const info = await getNpmPackageInfo(name, options);
        const version = info?.['dist-tags']?.[tag];
        if (version) {
          versions[name] = version;
        }
      })
    )
  );

  return versions;
}

/**
 * List all the versions of each package name.
 * Respects `options.npmReadConcurrency` for concurrency limiting.
 * @returns List of packages and versions
 */
export async function listPackageVersions(
  packageList: string[],
  options: NpmOptions
): Promise<{ [pkg: string]: string[] }> {
  const limit = pLimit(options.npmReadConcurrency);
  const versions: { [pkg: string]: string[] } = {};

  await Promise.all(
    packageList.map(pkg =>
      limit(async () => {
        const info = await getNpmPackageInfo(pkg, options);
        versions[pkg] = info?.versions || [];
      })
    )
  );

  return versions;
}
