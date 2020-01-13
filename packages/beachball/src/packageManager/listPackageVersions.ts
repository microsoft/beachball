import { npm } from './npm';

const packageVersions: { [pkgName: string]: string[] } = {};

export function listPackageVersions(packageName: string, registry: string) {
  if (!packageVersions[packageName]) {
    const showResult = npm(['show', '--registry', registry, '--json', packageName]);
    if (showResult.success) {
      const packageInfo = JSON.parse(showResult.stdout);
      packageVersions[packageName] = packageInfo.versions;
    } else {
      packageVersions[packageName] = [];
    }
  }

  return packageVersions[packageName];
}
