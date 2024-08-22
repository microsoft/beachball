import { BeachballOptions } from '../types/BeachballOptions';
import { PackageInfos } from '../types/PackageInfo';
import path from 'path';
import { isPathIncluded } from './isPathIncluded';

export function getScopedPackages(
  options: Pick<BeachballOptions, 'path' | 'scope'>,
  packageInfos: PackageInfos
): string[] {
  const { scope, path: cwd } = options;
  if (!scope) {
    return Object.keys(packageInfos);
  }

  let includeScopes: string[] | true = scope.filter(s => !s.startsWith('!'));
  // If there were no include scopes, include all paths by default
  includeScopes = includeScopes.length ? includeScopes : true;

  const excludeScopes = scope.filter(s => s.startsWith('!'));

  return Object.keys(packageInfos).filter(pkgName => {
    const packagePath = path.dirname(packageInfos[pkgName].packageJsonPath);

    return isPathIncluded(path.relative(cwd, packagePath), includeScopes, excludeScopes);
  });
}
