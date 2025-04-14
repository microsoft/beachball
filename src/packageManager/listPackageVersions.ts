import pLimit from 'p-limit';
import type { PackageInfo, PackageJson } from '../types/PackageInfo';
import type { NpmOptions } from '../types/NpmOptions';
import { env } from '../env';
import { npm } from './npm';
import { getNpmAuthArgs } from './npmArgs';

/**
 * Result returned by `npm show --json <package>`.
 * (Only includes the properties listed in `getNpmPackageInfo`.)
 */
export type NpmShowResult = PackageJson & {
  /** All versions of a package */
  versions: string[];
  /** Mapping from package dist-tag to version */
  'dist-tags': Record<string, string>;
};

let packageVersionsCache: { [pkgName: string]: NpmShowResult | false } = {};

/** Specific `npm show` properties requested by `listPackageVersions` */
export const npmShowProperties = ['versions', 'dist-tags'];

export function _clearPackageVersionsCache(): void {
  packageVersionsCache = {};
}

async function getNpmPackageInfo(packageName: string, options: NpmOptions): Promise<NpmShowResult | false> {
  const { registry, token, authType, timeout } = options;

  if (env.beachballDisableCache || !packageVersionsCache[packageName]) {
    const showResult = await npm(
      [
        'show',
        '--registry',
        registry,
        '--json',
        ...getNpmAuthArgs(registry, token, authType),
        packageName,
        // Only fetch the properties we need
        ...npmShowProperties,
      ],
      { timeout, cwd: options.path }
    );

    if (showResult.success && showResult.stdout !== '') {
      const packageInfo = JSON.parse(showResult.stdout);
      packageVersionsCache[packageName] = packageInfo;
    } else {
      packageVersionsCache[packageName] = false;
    }
  }

  return packageVersionsCache[packageName];
}

export async function listPackageVersionsByTag(
  packageInfos: PackageInfo[],
  tag: string | undefined,
  options: NpmOptions
): Promise<{ [pkg: string]: string }> {
  const limit = pLimit(options.npmReadConcurrency);
  const versions: { [pkg: string]: string } = {};

  await Promise.all(
    packageInfos.map(pkg =>
      limit(async () => {
        const info = await getNpmPackageInfo(pkg.name, options);
        if (info) {
          const npmTag = tag || pkg.combinedOptions.tag || pkg.combinedOptions.defaultNpmTag;
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
        versions[pkg] = (info && info.versions) || [];
      })
    )
  );

  return versions;
}
