import { npmAsync } from './npm';
import pLimit from 'p-limit';

const packageVersions: { [pkgName: string]: string[] } = {};

const NPM_CONCURRENCY = 5;

export async function listIndividualPackageVersions(packageName: string, registry: string) {
  if (!packageVersions[packageName]) {
    const showResult = await npmAsync(['show', '--registry', registry, '--json', packageName]);
    if (showResult.success) {
      const packageInfo = JSON.parse(showResult.stdout);
      packageVersions[packageName] = packageInfo.versions;
    } else {
      packageVersions[packageName] = [];
    }
  }

  return packageVersions[packageName];
}

export async function listPackageVersions(packageList: string[], registry: string) {
  const limit = pLimit(NPM_CONCURRENCY);
  const all: Promise<void>[] = [];
  const versions: { [pkg: string]: string[] } = {};

  for (const pkg of packageList) {
    all.push(
      limit(async () => {
        versions[pkg] = await listIndividualPackageVersions(pkg, registry);
      })
    );
  }

  await Promise.all(all);

  return versions;
}
