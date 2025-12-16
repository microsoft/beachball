import type { BumpInfo } from '../types/BumpInfo';
import type { BeachballOptions } from '../types/BeachballOptions';
import type { PackageInfos } from '../types/PackageInfo';
import { bumpInMemory } from './bumpInMemory';

/**
 * @deprecated Use `bumpInMemory` instead.
 */
export function gatherBumpInfo(options: BeachballOptions, originalPackageInfos: PackageInfos): BumpInfo {
  return bumpInMemory(options, originalPackageInfos);
}
