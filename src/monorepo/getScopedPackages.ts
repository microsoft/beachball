import type { BeachballOptions } from '../types/BeachballOptions';
import type { PackageInfos, ScopedPackages } from '../types/PackageInfo';
import path from 'path';
import { isPathIncluded } from './isPathIncluded';

/**
 * Get the set of in-scope package names.
 */
export function getScopedPackages(
  options: Pick<BeachballOptions, 'path' | 'scope'>,
  packageInfos: PackageInfos
): ScopedPackages {
  const { scope, path: cwd } = options;
  if (!scope) {
    const result: ScopedPackages = new Set(Object.keys(packageInfos));
    result.allInScope = true;
    return result;
  }

  let includeScopes: string[] | true = scope.filter(s => !s.startsWith('!'));
  // If there were no include scopes, include all paths by default
  includeScopes = includeScopes.length ? includeScopes : true;

  const excludeScopes = scope.filter(s => s.startsWith('!')).map(s => s.slice(1));

  const result = Object.keys(packageInfos).filter(pkgName => {
    const packagePath = path.dirname(packageInfos[pkgName].packageJsonPath);

    return isPathIncluded({
      relativePath: path.relative(cwd, packagePath),
      include: includeScopes,
      exclude: excludeScopes,
    });
  });
  return new Set(result);
}
