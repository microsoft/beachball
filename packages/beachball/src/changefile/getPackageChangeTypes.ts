import { ChangeInfo, ChangeSet, ChangeType } from '../types/ChangeInfo';

const ChangeTypeWeights = {
  major: 4,
  minor: 3,
  patch: 2,
  prerelease: 1,
  none: 0,
};

export function getPackageChangeTypes(changeSet: ChangeSet) {
  const changePerPackage: {
    [pkgName: string]: ChangeInfo['type'];
  } = {};

  for (let [_, change] of changeSet) {
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
    // minus 2 here because of 0 and 1 based index conversion
    changeType = Object.keys(ChangeTypeWeights)[ChangeTypeWeights[changeType] - 2] as keyof typeof ChangeTypeWeights;
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
