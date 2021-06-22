import fs from 'fs-extra';
import path from 'path';
import { getNpmAuthArgs, npmAsync } from './npm';
import pLimit from 'p-limit';
import { PackageInfo } from '../types/PackageInfo';
import { AuthType } from '../types/Auth';
import { ChangelogJson } from '../types/ChangeLog';

const packageVersions: { [pkgName: string]: any } = {};

const NPM_CONCURRENCY = 5;

export async function getNpmPackageInfo(packageName: string, registry: string, token?: string, authType?: AuthType) {
  if (!packageVersions[packageName]) {
    const args = ['show', '--registry', registry, '--json', packageName, ...getNpmAuthArgs(registry, token, authType)];

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
  token?: string,
  authType?: AuthType
) {
  const limit = pLimit(NPM_CONCURRENCY);
  const all: Promise<void>[] = [];
  const versions: { [pkg: string]: string } = {};

  for (const pkg of packageInfos) {
    all.push(
      limit(async () => {
        const info = await getNpmPackageInfo(pkg.name, registry, token, authType);
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

export async function listPackageVersionsFromChangelog(packageInfos: PackageInfo[]) {
  const all: Promise<void>[] = [];
  const versions: { [pkg: string]: string } = {};
  const getVersionFromChangelog = async (pkg: PackageInfo) => {
    try {
      const changelog: ChangelogJson = await fs.readJSON(path.join(path.dirname(pkg.packageJsonPath), 'CHANGELOG.json'));
      if (changelog && changelog.entries && changelog.entries.length) {
        versions[pkg.name] = changelog.entries[0].version;
      }
    } catch {
      // IO exception or new package
    }
  };

  for (const pkg of packageInfos) {
    all.push(
      getVersionFromChangelog(pkg)
    );
  }

  await Promise.all(all);

  return versions;
}
