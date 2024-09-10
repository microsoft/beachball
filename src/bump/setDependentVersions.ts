import type { BeachballOptions } from '../types/BeachballOptions';
import { BumpInfo } from '../types/BumpInfo';
import { consideredDependencies, type PackageInfos } from '../types/PackageInfo';
import { bumpMinSemverRange } from './bumpMinSemverRange';

/**
 * Go through the deps of each package and bump the version range for in-repo deps if needed.
 *
 * **This mutates dep versions in `packageInfos`** as well as returning `dependentChangedBy`.
 */
export function setDependentVersions(
  packageInfos: PackageInfos,
  scopedPackages: ReadonlySet<string>,
  options: Pick<BeachballOptions, 'verbose'>
): BumpInfo['dependentChangedBy'] {
  const { verbose } = options;
  const dependentChangedBy: BumpInfo['dependentChangedBy'] = {};

  for (const [pkgName, info] of Object.entries(packageInfos)) {
    if (!scopedPackages.has(pkgName)) {
      continue; // out of scope
    }

    for (const depType of consideredDependencies) {
      const deps = info[depType] || {};

      for (const [dep, existingVersionRange] of Object.entries(deps)) {
        const depPackage = packageInfos[dep];
        if (!depPackage) {
          continue; // external dependency
        }

        const bumpedVersionRange = bumpMinSemverRange(depPackage.version, existingVersionRange);
        // TODO: dependent bumps in workspace:*/^/~ ranges will be missed
        // https://github.com/microsoft/beachball/issues/981
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
