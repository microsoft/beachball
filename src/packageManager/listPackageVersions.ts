import { npmAsync } from './npm';
import pLimit from 'p-limit';
import { PackageInfo } from '../types/PackageInfo';

const packageVersions: { [pkgName: string]: any } = {};

const NPM_CONCURRENCY = 5;

export async function getNpmPackageInfo(packageName: string, registry: string, token: string | null = null) {
  if (!packageVersions[packageName]) {
    const args = ['show', '--registry', registry, '--json', packageName];

    if (token) {
      const shorthand = registry.substring(registry.indexOf('//'));
      args.push(`--${shorthand}:_authToken=${token}`);
    }

    const showResult = await npmAsync(args);
    if (showResult.success) {
      const packageInfo = JSON.parse(showResult.stdout);
      packageVersions[packageName] = packageInfo;
    } else {
      packageVersions[packageName] = {};
    }
  }

  return packageVersions[packageName];
}

export async function listPackageVersionsByTag(
  packageInfos: PackageInfo[],
  registry: string,
  tag: string,
  token?: string | null
) {
  const limit = pLimit(NPM_CONCURRENCY);
  const all: Promise<void>[] = [];
  const versions: { [pkg: string]: string } = {};

  for (const pkg of packageInfos) {
    all.push(
      limit(async () => {
        const info = await getNpmPackageInfo(pkg.name, registry, token);
        const npmTag = tag || pkg.combinedOptions.tag || pkg.combinedOptions.defaultNpmTag;
        versions[pkg.name] = info['dist-tags'] && info['dist-tags'][npmTag] ? info['dist-tags'][npmTag] : undefined;
      })
    );
  }

  await Promise.all(all);

  return versions;
}

export async function listPackageVersions(packageList: string[], registry: string) {
  const limit = pLimit(NPM_CONCURRENCY);
  const all: Promise<void>[] = [];
  const versions: { [pkg: string]: string[] } = {};

  for (const pkg of packageList) {
    all.push(
      limit(async () => {
        const info = await getNpmPackageInfo(pkg, registry);
        versions[pkg] = info && info.versions ? info.versions : [];
      })
    );
  }

  await Promise.all(all);

  return versions;
}
