import type { BeachballOptions } from '../types/BeachballOptions';
import type { PackageInfos } from '../types/PackageInfo';
import { bumpMinSemverRange } from './bumpMinSemverRange';

export function setDependentVersions(
  packageInfos: PackageInfos,
  scopedPackages: Set<string>,
  { verbose }: BeachballOptions
) {
  const dependentChangedBy: { [dependent: string]: Set<string> } = {};

  Object.keys(packageInfos).forEach(pkgName => {
    if (!scopedPackages.has(pkgName)) {
      return;
    }

    const info = packageInfos[pkgName];
    const depTypes = ['dependencies', 'devDependencies', 'peerDependencies'] as const;
    depTypes.forEach(depKind => {
      const deps = info[depKind];
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
              if (verbose) {
                console.log(
                  `${pkgName} needs to be bumped because ${dep} ${existingVersionRange} -> ${bumpedVersionRange}`
                );
              }
            }
          }
        });
      }
    });
  });

  return dependentChangedBy;
}
