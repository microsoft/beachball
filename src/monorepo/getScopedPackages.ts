import type { BeachballOptions } from '../types/BeachballOptions';
import type { PackageInfos } from '../types/PackageInfo';
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

  const excludeScopes = scope.filter(s => s.startsWith('!')).map(s => s.slice(1));

  return Object.keys(packageInfos).filter(pkgName => {
    const packagePath = path.dirname(packageInfos[pkgName].packageJsonPath);

    return isPathIncluded({
      relativePath: path.relative(cwd, packagePath),
      include: includeScopes,
      exclude: excludeScopes,
    });
  });
}
