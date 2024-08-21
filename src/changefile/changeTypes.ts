import { ChangeSet, ChangeType } from '../types/ChangeInfo';

/**
 * List of all change types from least to most significant.
 */
export const SortedChangeTypes: ChangeType[] = ['none', 'prerelease', 'prepatch', 'patch', 'preminor', 'minor', 'premajor', 'major'];

/**
 * Change type with the smallest weight.
 */
export const MinChangeType = SortedChangeTypes[0];

/**
 * Change type weights.
 * Note: the order in which this is defined is IMPORTANT.
 */
const ChangeTypeWeights = Object.fromEntries(SortedChangeTypes.map((t, i) => [t, i])) as { [t in ChangeType]: number };

/**
 * Get initial package change types based on the greatest change type set for each package in any
 * change file, accounting for any disallowed change types or nonexistent packages.
 */
export function initializePackageChangeTypes(changeSet: ChangeSet): { [pkgName: string]: ChangeType } {
  const pkgChangeTypes: { [pkgName: string]: ChangeType } = {};

  for (const { change } of changeSet) {
    const { packageName: pkg, type } = change;
    pkgChangeTypes[pkg] = getMaxChangeType(type, pkgChangeTypes[pkg] || 'none', null);
  }

  return pkgChangeTypes;
}

function getAllowedChangeType(changeType: ChangeType, disallowedChangeTypes: ChangeType[]): ChangeType {
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
export function getMaxChangeType(a: ChangeType, b: ChangeType, disallowedChangeTypes: ChangeType[] | null): ChangeType {
  if (disallowedChangeTypes) {
    a = getAllowedChangeType(a, disallowedChangeTypes);
    b = getAllowedChangeType(b, disallowedChangeTypes);
  }

  return ChangeTypeWeights[a] > ChangeTypeWeights[b] ? a : b;
}
