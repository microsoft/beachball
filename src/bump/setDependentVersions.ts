import type { BeachballOptions } from '../types/BeachballOptions';
import type { BumpInfo } from '../types/BumpInfo';
import { consideredDependencies } from '../types/PackageInfo';
import { bumpMinSemverRange } from './bumpMinSemverRange';

/**
 * Go through the deps of each package and bump the version range for in-repo deps if needed.
 * Prior to calling this, it's expected that:
 * - package versions in `bumpInfo.packageInfos` have been bumped per change files and dependentChangeTypes
 * - `bumpInfo.modifiedPackages` contains all packages whose version has been bumped
 *
 * **This mutates dependency versions in `packageInfos`** and might add to `bumpInfo.modifiedPackages`.
 * Probably the only case where it will change `modifiedPackages` is if `BeachballOptions.bumpDeps` is false
 * (or if this is being called by `sync` which didn't previously bump dependents).
 */
export function setDependentVersions(
  bumpInfo: Pick<BumpInfo, 'packageInfos' | 'scopedPackages' | 'modifiedPackages'>,
  options: Pick<BeachballOptions, 'verbose'>
): BumpInfo['dependentChangedBy'] {
  const { packageInfos, scopedPackages, modifiedPackages } = bumpInfo;
  const { verbose } = options;
  const dependentChangedBy: BumpInfo['dependentChangedBy'] = {};

  for (const [pkgName, info] of Object.entries(packageInfos)) {
    if (!scopedPackages.allInScope && !scopedPackages.has(pkgName)) {
      continue; // out of scope
    }

    for (const depType of consideredDependencies) {
      const deps = info[depType] || {};

      for (const [dep, existingVersionRange] of Object.entries(deps)) {
        const depPackage = packageInfos[dep];
        // TODO: should this use the initial modifiedPackages rather than the possibly-updated one?
        // (considering updates could introduce order sensitivity, though the old logic that didn't
        // check modifiedPackages at all also had that issue)
        if (!depPackage || !modifiedPackages.has(dep)) {
          continue; // external dependency or not modified
        }

        const bumpedVersionRange = bumpMinSemverRange(depPackage.version, existingVersionRange);
        // TODO: dependent bumps in workspace:*/^/~ ranges will be missed
        // https://github.com/microsoft/beachball/issues/981
        if (existingVersionRange !== bumpedVersionRange) {
          deps[dep] = bumpedVersionRange;

          dependentChangedBy[pkgName] ??= new Set<string>();
          dependentChangedBy[pkgName].add(dep);

          // Unless bumpDeps was false, the package should have been added to modifiedPackages
          // by updateRelatedChangeType plus bumpPackageInfoVersion, but to be safe we add it here too.
          // TODO: fix behavior - https://github.com/microsoft/beachball/issues/620
          modifiedPackages.add(pkgName);

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
