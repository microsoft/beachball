import { BeachballOptions } from '../types/BeachballOptions';
import { getPackageInfos } from './getPackageInfos';
import minimatch from 'minimatch';
import path from 'path';

export function getScopedPackages(options: BeachballOptions) {
  const packageInfos = getPackageInfos(options.path);
  if (!options.scope) {
    return Object.keys(packageInfos);
  }

  const scopes = options.scope!.map(scope => path.join(options.path, scope));
  const scopedPackages: string[] = [];

  for (let [pkgName, info] of Object.entries(packageInfos)) {
    if (scopes.some(scope => minimatch(path.dirname(info.packageJsonPath), scope))) {
      scopedPackages.push(pkgName);
    }
  }

  return scopedPackages;
}
