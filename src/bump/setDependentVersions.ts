import { PackageInfos, PackageDeps } from '../types/PackageInfo';
import { bumpMinSemverRange } from './bumpMinSemverRange';

export function setDependentVersions(packageInfos: PackageInfos) {
  const modifiedPackages = new Set<string>();
  Object.keys(packageInfos).forEach(pkgName => {
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
              modifiedPackages.add(pkgName);
            }
          }
        });
      }
    });
  });

  return modifiedPackages;
}
