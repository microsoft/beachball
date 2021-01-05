import { BumpInfo } from '../types/BumpInfo';

export function shouldPublishPackage(
  bumpInfo: BumpInfo,
  pkgName: string
): {
  publish: boolean;
  reasonToSkip?: string;
} {
  const packageInfo = bumpInfo.packageInfos[pkgName];
  const changeType = bumpInfo.packageChangeTypes[pkgName]?.type;

  if (changeType === 'none') {
    return {
      publish: false,
      reasonToSkip: `package ${pkgName} has change type as none`,
    };
  }

  if (packageInfo.private) {
    return {
      publish: false,
      reasonToSkip: `package ${pkgName} is private`,
    };
  }
  if (!bumpInfo.scopedPackages.has(pkgName)) {
    return {
      publish: false,
      reasonToSkip: `package ${pkgName} is out-of-scope`,
    };
  }

  return { publish: true };
}
