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

export function getMaxChangeType(a: ChangeType, b: ChangeType) {
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
