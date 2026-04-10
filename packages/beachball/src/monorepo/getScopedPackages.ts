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

  const packageNames = Object.keys(packageInfos);
  let result: Set<string>;

  if (scope) {
    let includeScopes: string[] | true = scope.filter(s => !s.startsWith('!'));
    // If there were no include scopes, include all paths by default
    includeScopes = includeScopes.length ? includeScopes : true;

    const excludeScopes = scope.filter(s => s.startsWith('!'));

    result = new Set(
      packageNames.filter(pkgName => {
        const packagePath = path.dirname(packageInfos[pkgName].packageJsonPath);

        return isPathIncluded(path.relative(cwd, packagePath), includeScopes, excludeScopes);
      })
    );
  } else {
    result = new Set(packageNames);
  }

  if (result.size === packageNames.length) {
    // Override .has() to always return true unless the package doesn't exist
    result.has = packageName => !!packageInfos[packageName];
  }

  return result;
}
