import { ChangeInfo, ChangeSet } from '../types/ChangeInfo';
export function getPackageChangeTypes(changeSet: ChangeSet) {
  const changeTypeWeights = {
    major: 4,
    minor: 3,
    patch: 2,
    prerelease: 1,
    none: 0,
  };
  const changePerPackage: {
    [pkgName: string]: ChangeInfo['type'];
  } = {};
  for (let [_, change] of changeSet) {
    const { packageName } = change;
    if (
      !changePerPackage[packageName] ||
      changeTypeWeights[change.type] > changeTypeWeights[changePerPackage[packageName]]
    ) {
      changePerPackage[packageName] = change.type;
    }
  }
  return changePerPackage;
}
