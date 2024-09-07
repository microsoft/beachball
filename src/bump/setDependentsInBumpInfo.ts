import type { BumpInfo } from '../types/BumpInfo';

/**
 * Set dependents for all packages. **This mutates `bumpInfo.dependents`.**
 *
 * Example: "BigApp" deps on "SomeUtil", "BigApp" would be the dependent
 */
export function setDependentsInBumpInfo(
  bumpInfo: Pick<BumpInfo, 'packageInfos' | 'scopedPackages' | 'dependents'>
): void {
  const { packageInfos, scopedPackages, dependents } = bumpInfo;

  for (const [pkgName, info] of Object.entries(packageInfos)) {
    if (!scopedPackages.has(pkgName)) {
      continue;
    }

    for (const deps of [info.dependencies, info.devDependencies, info.peerDependencies, info.optionalDependencies]) {
      for (const dep of Object.keys(deps || {})) {
        if (packageInfos[dep]) {
          dependents[dep] ??= [];
          if (!dependents[dep].includes(pkgName)) {
            dependents[dep].push(pkgName);
          }
        }
      }
    }
  }
}
