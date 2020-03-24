import { BeachballOptions } from '../types/BeachballOptions';
import { getPackageInfos } from './getPackageInfos';
import path from 'path';
import { isPathIncluded } from './utils';

export function getScopedPackages(options: BeachballOptions) {
  const packageInfos = getPackageInfos(options.path);
  if (!options.scope) {
    return Object.keys(packageInfos);
  }

  let includeScopes = options.scope!.filter(s => !s.startsWith('!'));
  includeScopes = includeScopes.length > 0 ? includeScopes : ['**/*', '', '*'];
  const excludeScopes = options.scope!.filter(s => s.startsWith('!'));

  const scopedPackages: string[] = [];

  for (let [pkgName, info] of Object.entries(packageInfos)) {
    const relativePath = path.relative(options.path, path.dirname(info.packageJsonPath));

    const shouldInclude = isPathIncluded(relativePath, includeScopes, excludeScopes);
    if (shouldInclude) {
      scopedPackages.push(pkgName);
    }
  }

  return scopedPackages;
}
