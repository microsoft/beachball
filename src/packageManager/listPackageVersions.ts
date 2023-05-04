import { getNpmAuthArgs, npmAsync } from './npm';
import pLimit from 'p-limit';
import { PackageInfo } from '../types/PackageInfo';
import { NpmOptions } from '../types/NpmOptions';

const packageVersionsCache: { [pkgName: string]: any } = {};

const NPM_CONCURRENCY = 5;

async function getNpmPackageInfo(packageName: string, options: NpmOptions) {
  const { registry, token, authType, timeout } = options;

  if (process.env.BEACHBALL_DISABLE_CACHE || !packageVersionsCache[packageName]) {
    const args = ['show', '--registry', registry, '--json', packageName, ...getNpmAuthArgs(registry, token, authType)];

    const showResult = await npmAsync(args, { timeout });

    if (showResult.success && showResult.stdout !== '') {
      const packageInfo = JSON.parse(showResult.stdout);
      packageVersionsCache[packageName] = packageInfo;
    } else {
      packageVersionsCache[packageName] = {};
    }
  }

  return packageVersionsCache[packageName];
}

export async function listPackageVersionsByTag(
  packageInfos: PackageInfo[],
  tag: string | undefined,
  options: NpmOptions
) {
  const limit = pLimit(NPM_CONCURRENCY);
  const versions: { [pkg: string]: string } = {};

  await Promise.all(
    packageInfos.map(pkg =>
      limit(async () => {
        const info = await getNpmPackageInfo(pkg.name, options);
        const npmTag = tag || pkg.combinedOptions.tag || pkg.combinedOptions.defaultNpmTag;
        versions[pkg.name] = info['dist-tags'] && info['dist-tags'][npmTag] ? info['dist-tags'][npmTag] : undefined;
      })
    )
  );

  return versions;
}

export async function listPackageVersions(packageList: string[], options: NpmOptions) {
  const limit = pLimit(NPM_CONCURRENCY);
  const versions: { [pkg: string]: string[] } = {};

  await Promise.all(
    packageList.map(pkg =>
      limit(async () => {
        const info = await getNpmPackageInfo(pkg, options);
        versions[pkg] = info && info.versions ? info.versions : [];
      })
    )
  );

  return versions;
}
