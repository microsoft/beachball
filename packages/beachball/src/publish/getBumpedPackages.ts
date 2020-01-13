import { BumpInfo } from '../types/BumpInfo';
export function getBumpedPackages(bumpInfo: BumpInfo): string[] {
  let bumpedPackages: string[] = Object.keys(bumpInfo.packageChangeTypes);
  if (bumpInfo.bumpedDependents) {
    bumpedPackages = bumpedPackages.concat(bumpInfo.bumpedDependents);
  }
  return bumpedPackages;
}
