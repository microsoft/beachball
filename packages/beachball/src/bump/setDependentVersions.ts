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
 * **This mutates dependency versions in `packageInfos`!**
 */
export function setDependentVersions(params: {
  bumpInfo: Pick<BumpInfo, 'packageInfos' | 'scopedPackages' | 'modifiedPackages'>;
  options: Pick<BeachballOptions, 'verbose'>;
  skipImplicitBumps?: boolean;
}): BumpInfo['dependentChangedBy'] {
  const { bumpInfo, options, skipImplicitBumps } = params;
  const { packageInfos, scopedPackages, modifiedPackages } = bumpInfo;
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
        // If it's an external dependency or a package whose version wasn't modified, skip it
        if (!depPackage || !modifiedPackages.has(dep)) {
          continue;
        }

        // Bump the range if relevant (see doc comment about the return value)
        const newRange = bumpMinSemverRange({
          newVersion: depPackage.version,
          currentRange: existingVersionRange,
        });

        // TODO: All this logic is questionable with bumpDeps: false or scopes... https://github.com/microsoft/beachball/issues/1123
        // see also https://github.com/microsoft/beachball/issues/620 and https://github.com/microsoft/beachball/issues/1033
        const rangeChanged = typeof newRange === 'string';
        if (rangeChanged) {
          // Update the version range of the dependency if the literal range changed due to bumps.
          deps[dep] = newRange;
        }
        if (rangeChanged || (newRange === true && !skipImplicitBumps)) {
          dependentChangedBy[pkgName] ??= new Set<string>();
          dependentChangedBy[pkgName].add(dep);

          if (verbose) {
            console.log(
              rangeChanged
                ? `${pkgName} needs to be bumped because ${dep} ${existingVersionRange} -> ${newRange}`
                : `${pkgName} needs a changelog entry because ${dep} was bumped to ${depPackage.version} (range ${existingVersionRange} unchanged)`
            );
          }
        }
      }
    }
  }

  return dependentChangedBy;
}
