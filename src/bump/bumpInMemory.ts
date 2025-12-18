import { initializePackageChangeTypes } from '../changefile/changeTypes';
import type { BumpInfo } from '../types/BumpInfo';
import { bumpInPlace } from './bumpInPlace';
import type { BeachballOptions } from '../types/BeachballOptions';
import { cloneObject } from '../object/cloneObject';
import type { CommandContext } from '../types/CommandContext';

/**
 * Gather bump info and bump versions in memory.
 * Does NOT mutate the given `context.originalPackageInfos`.
 * @param context Pre-calculated context
 */
export function bumpInMemory(options: BeachballOptions, context: Omit<CommandContext, 'bumpInfo'>): BumpInfo {
  // Determine base change types for each package (not considering disallowedChangeTypes or groups)
  const calculatedChangeTypes = initializePackageChangeTypes(context.changeSet);

  const bumpInfo: BumpInfo = {
    calculatedChangeTypes,
    packageInfos: cloneObject(context.originalPackageInfos),
    packageGroups: context.packageGroups,
    changeFileChangeInfos: context.changeSet,
    modifiedPackages: new Set<string>(),
    scopedPackages: context.scopedPackages,
    dependentChangedBy: {},
  };

  bumpInPlace(bumpInfo, options);

  return bumpInfo;
}
