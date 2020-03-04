import { BeachballOptions } from '../types/BeachballOptions';
import { getPackageInfos } from './getPackageInfos';
import minimatch from 'minimatch';
import path from 'path';

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

    let shouldInclude = includeScopes.reduce((flag, scope) => flag || minimatch(relativePath, scope), false);

    shouldInclude = excludeScopes.reduce((flag, scope) => flag && minimatch(relativePath, scope), shouldInclude);

    if (shouldInclude) {
      scopedPackages.push(pkgName);
    }
  }

  return scopedPackages;
}
