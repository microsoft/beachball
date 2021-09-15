import { PackageInfos, PackageDeps } from '../types/PackageInfo';
import { bumpMinSemverRange } from './bumpMinSemverRange';

export function setDependentVersions(packageInfos: PackageInfos, scopedPackages: Set<string>) {
  const dependentChangedBy: {[dependent: string]: Set<string>} = {};

  Object.keys(packageInfos).forEach(pkgName => {
    if (!scopedPackages.has(pkgName)) {
      return;
    }

    const info = packageInfos[pkgName];
    ['dependencies', 'devDependencies', 'peerDependencies'].forEach(depKind => {
      const deps: PackageDeps | undefined = (info as any)[depKind];
      if (deps) {
        Object.keys(deps).forEach(dep => {
          const packageInfo = packageInfos[dep];
          if (packageInfo) {
            const existingVersionRange = deps[dep];
            const bumpedVersionRange = bumpMinSemverRange(packageInfo.version, existingVersionRange);
            if (existingVersionRange !== bumpedVersionRange) {
              deps[dep] = bumpedVersionRange;

              dependentChangedBy[pkgName] = dependentChangedBy[pkgName] || new Set<string>();
              dependentChangedBy[pkgName].add(dep);
            }
          }
        });
      }
    });
  });

  return dependentChangedBy;
}
