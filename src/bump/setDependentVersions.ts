import type { BeachballOptions } from '../types/BeachballOptions';
import type { PackageInfos } from '../types/PackageInfo';
import { bumpMinSemverRange } from './bumpMinSemverRange';

export function setDependentVersions(
  packageInfos: PackageInfos,
  scopedPackages: Set<string>,
  { verbose }: BeachballOptions
): { [dependent: string]: Set<string> } {
  const dependentChangedBy: { [dependent: string]: Set<string> } = {};

  for (const [pkgName, info] of Object.entries(packageInfos)) {
    if (!scopedPackages.has(pkgName)) {
      continue;
    }

    for (const deps of [info.dependencies, info.devDependencies, info.peerDependencies]) {
      if (!deps) {
        continue;
      }

      for (const [dep, existingVersionRange] of Object.entries(deps)) {
        const packageInfo = packageInfos[dep];
        if (!packageInfo) {
          continue;
        }

        const bumpedVersionRange = bumpMinSemverRange(packageInfo.version, existingVersionRange);
        if (existingVersionRange !== bumpedVersionRange) {
          deps[dep] = bumpedVersionRange;

          dependentChangedBy[pkgName] ??= new Set<string>();
          dependentChangedBy[pkgName].add(dep);
          if (verbose) {
            console.log(
              `${pkgName} needs to be bumped because ${dep} ${existingVersionRange} -> ${bumpedVersionRange}`
            );
          }
        }
      }
    }
  }

  return dependentChangedBy;
}
