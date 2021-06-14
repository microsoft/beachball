import { CliOptions } from '../types/BeachballOptions';
import { PackageInfos, PackageDeps } from '../types/PackageInfo';
import { applySemverRange } from './applySemverRange';
import { bumpMinSemverRange } from './bumpMinSemverRange';

export function setDependentVersions(packageInfos: PackageInfos, scopedPackages: Set<string>, replaceStars?: CliOptions['replaceStars']) {
  const modifiedPackages = new Set<string>();
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
            const semverRange = replaceStars ? applySemverRange(replaceStars, packageInfo.version) : existingVersionRange;
            const bumpedVersionRange = bumpMinSemverRange(packageInfo.version, semverRange);
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
