import type { BumpInfo } from '../types/BumpInfo';
import type { BeachballOptions } from '../types/BeachballOptions';

/**
 * Gets dependents for all packages
 *
 * Example: "BigApp" deps on "SomeUtil", "BigApp" would be the dependent
 */
export function setDependentsInBumpInfo(bumpInfo: BumpInfo, { bumpPeerDeps = true }: BeachballOptions): void {
  const { packageInfos, scopedPackages } = bumpInfo;
  const dependents: BumpInfo['dependents'] = {};

  for (const [pkgName, info] of Object.entries(packageInfos)) {
    if (!scopedPackages.has(pkgName)) {
      continue;
    }

    for (const deps of [
      info.dependencies,
      info.devDependencies,
      bumpPeerDeps && info.peerDependencies,
      info.optionalDependencies,
    ]) {
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

  bumpInfo.dependents = dependents;
}
