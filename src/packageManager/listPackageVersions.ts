import { npmAsync } from './npm';
import pLimit from 'p-limit';
import { PackageInfo } from '../types/PackageInfo';

const packageVersions: { [pkgName: string]: any } = {};

const NPM_CONCURRENCY = 5;

export async function getNpmPackageInfo(packageName: string, registry: string) {
  if (!packageVersions[packageName]) {
    const showResult = await npmAsync(['show', '--registry', registry, '--json', packageName]);
    if (showResult.success) {
      const packageInfo = JSON.parse(showResult.stdout);
      packageVersions[packageName] = packageInfo;
    } else {
      packageVersions[packageName] = {};
    }
  }

  return packageVersions[packageName];
}

export async function listPackageVersionsByTag(packageInfos: PackageInfo[], registry: string, tag: string) {
  const limit = pLimit(NPM_CONCURRENCY);
  const all: Promise<void>[] = [];
  const versions: { [pkg: string]: string } = {};

  for (const pkg of packageInfos) {
    all.push(
      limit(async () => {
        const info = await getNpmPackageInfo(pkg.name, registry);
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
