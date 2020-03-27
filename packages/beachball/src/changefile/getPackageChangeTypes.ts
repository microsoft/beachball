import { ChangeFileInfo, ChangeSet, ChangeType } from '../types/ChangeInfo';

/**
 * List of all change types from least to most significant.
 */
export const SortedChangeTypes: ChangeType[] = ['none', 'prerelease', 'patch', 'minor', 'major'];

/**
 * Change type with the smallest weight.
 */
export const MinChangeType = SortedChangeTypes[0];

/**
 * Change type weights.
 * Note: the order in which this is defined is IMPORTANT.
 */
const ChangeTypeWeights: { [t in ChangeType]: number } = SortedChangeTypes.reduce((weights, changeType, index) => {
  weights[changeType] = index;
  return weights;
}, {} as { [t in ChangeType]: number });

export function getPackageChangeTypes(changeSet: ChangeSet) {
  const changePerPackage: {
    [pkgName: string]: ChangeFileInfo['type'];
  } = {};

  for (let change of changeSet.values()) {
    const { packageName } = change;
    if (!changePerPackage[packageName] || isChangeTypeGreater(change.type, changePerPackage[packageName])) {
      changePerPackage[packageName] = change.type;
    }
  }
  return changePerPackage;
}

export function isChangeTypeGreater(a: ChangeType, b: ChangeType) {
  if (ChangeTypeWeights[a] > ChangeTypeWeights[b]) {
    return true;
  } else {
    return false;
  }
}

export function getAllowedChangeType(changeType: ChangeType, disallowedChangeTypes: ChangeType[] | null): ChangeType {
  if (!changeType) {
    return 'none';
  }

  if (!disallowedChangeTypes) {
    return changeType;
  }

  while (disallowedChangeTypes.includes(changeType) && changeType !== 'none') {
    const nextChangeTypeWeight = ChangeTypeWeights[changeType] - 1;
    changeType = SortedChangeTypes[nextChangeTypeWeight];
  }

  return changeType;
}

export function getMaxChangeType(inputA: ChangeType, inputB: ChangeType, disallowedChangeTypes: ChangeType[] | null) {
  const a = getAllowedChangeType(inputA, disallowedChangeTypes);
  const b = getAllowedChangeType(inputB, disallowedChangeTypes);

  if (!b && !a) {
    return 'none';
  }

  if (!b) {
    return a;
  }

  if (!a) {
    return b;
  }

  if (isChangeTypeGreater(a, b)) {
    return a;
  } else {
    return b;
  }
}
