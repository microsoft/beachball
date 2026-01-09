import type { BumpInfo } from '../types/BumpInfo';
import type { BeachballOptions } from '../types/BeachballOptions';
import type { PackageInfos } from '../types/PackageInfo';
import { bumpInMemory } from './bumpInMemory';
import { createCommandContext } from '../monorepo/createCommandContext';

/**
 * @deprecated Use `bumpInMemory` instead.
 */
export function gatherBumpInfo(options: BeachballOptions, originalPackageInfos: PackageInfos): BumpInfo {
  // eslint-disable-next-line beachball/no-deprecated -- compat code
  return bumpInMemory(options, createCommandContext(options, originalPackageInfos));
}
