import { BumpInfo } from '../types/BumpInfo';
import type { ChangeSet, ChangeType } from '../types/ChangeInfo';

/**
 * List of all change types from least to most significant.
 */
export const SortedChangeTypes = [
  'none',
  'prerelease',
  'prepatch',
  'patch',
  'preminor',
  'minor',
  'premajor',
  'major',
] as const satisfies readonly ChangeType[];

/** `'none'` change type (smallest weight) */
export const MinChangeType: ChangeType = 'none';

/**
 * Change type weights.
 * Note: the order in which this is defined is IMPORTANT.
 */
const ChangeTypeWeights = Object.fromEntries(SortedChangeTypes.map((t, i) => [t, i])) as Record<ChangeType, number>;

/**
 * Get initial package change types based on the greatest change type set for each package in any
 * change file, accounting for any disallowed change types or nonexistent packages.
 * Anything with change type "none" will be ignored.
 */
export function initializePackageChangeTypes(changeSet: ChangeSet): BumpInfo['calculatedChangeTypes'] {
  const pkgChangeTypes: BumpInfo['calculatedChangeTypes'] = {};

  for (const { change } of changeSet) {
    const { packageName: pkg } = change;
    const changeType = getMaxChangeType(change.type, pkgChangeTypes[pkg]);
    // It's best to totally ignore "none" changes to do a bit less processing.
    if (changeType !== 'none') {
      pkgChangeTypes[pkg] = changeType;
    }
  }

  return pkgChangeTypes;
}

function getAllowedChangeType(changeType: ChangeType, disallowedChangeTypes: ReadonlyArray<ChangeType>): ChangeType {
  if (!changeType) {
    return 'none'; // this would be from invalid user input
  }

  while (disallowedChangeTypes.includes(changeType) && changeType !== 'none') {
    const nextChangeTypeWeight = ChangeTypeWeights[changeType] - 1;
    changeType = SortedChangeTypes[nextChangeTypeWeight];
  }

  return changeType;
}

/**
 * Get the max allowed change type based on `a` and `b`, accounting for disallowed change types:
 * e.g. if `a` is "major" and `b` is "patch", and "major" is disallowed, the result will be "minor"
 * (the greatest allowed change type).
 */
export function getMaxChangeType(
  a: ChangeType | undefined,
  b?: ChangeType,
  disallowedChangeTypes?: ReadonlyArray<ChangeType> | null
): ChangeType {
  if (disallowedChangeTypes?.length) {
    a = a && getAllowedChangeType(a, disallowedChangeTypes);
    b = b && getAllowedChangeType(b, disallowedChangeTypes);
  }

  return a && b ? (ChangeTypeWeights[a] > ChangeTypeWeights[b] ? a : b) : a || b || 'none';
}
