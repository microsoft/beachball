import type { BumpInfo, PackageDependents } from '../types/BumpInfo';
import { consideredDependencies } from '../types/PackageInfo';

/**
 * Gets dependents for all packages (child points to parents): if A depends on B, then `{B: [A]}`
 *
 * Example: "BigApp" deps on "SomeUtil", "BigApp" would be the dependent.
 * => `{ "SomeUtil": ["BigApp"] }`
 */
export function getDependentsForPackages(
  bumpInfo: Pick<BumpInfo, 'packageInfos' | 'scopedPackages'>
): PackageDependents {
  const { packageInfos, scopedPackages } = bumpInfo;

  const dependents: { [pkgName: string]: string[] } = {};

  for (const [pkgName, info] of Object.entries(packageInfos)) {
    if (!scopedPackages.has(pkgName)) {
      continue;
    }

    for (const depType of consideredDependencies) {
      for (const dep of Object.keys(info[depType] || {})) {
        if (packageInfos[dep]) {
          dependents[dep] ??= [];
          if (!dependents[dep].includes(pkgName)) {
            dependents[dep].push(pkgName);
          }
        }
      }
    }
  }

  return dependents;
}
