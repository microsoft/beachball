import { BumpInfo } from '../types/BumpInfo';

export function shouldPublishPackage(
  bumpInfo: BumpInfo,
  pkgName: string
): {
  publish: boolean;
  reasonToSkip?: string;
} {
  const packageInfo = bumpInfo.packageInfos[pkgName];
  const changeType = bumpInfo.calculatedChangeTypes[pkgName];

  if (changeType === 'none') {
    return {
      publish: false,
      reasonToSkip: `${pkgName} has change type none`,
    };
  }

  if (packageInfo.private) {
    return {
      publish: false,
      reasonToSkip: `${pkgName} is private`,
    };
  }
  if (!bumpInfo.scopedPackages.has(pkgName)) {
    return {
      publish: false,
      reasonToSkip: `${pkgName} is out-of-scope`,
    };
  }

  return { publish: true };
}
