import pLimit from 'p-limit';
import type { PackageInfo } from '../types/PackageInfo';
import type { NpmOptions } from '../types/NpmOptions';
import { getNpmPackageInfo } from './getNpmPackageInfo';

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

  await Promise.all(
    packageInfos.map(pkg =>
      limit(async () => {
        const npmTag = pkg.combinedOptions.tag || pkg.combinedOptions.defaultNpmTag;
        const info = await getNpmPackageInfo(pkg.name, options);
        if (info) {
          const version = npmTag && info['dist-tags']?.[npmTag];
          if (version) {
            versions[pkg.name] = version;
          }
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
