import type { BeachballOptions } from '../types/BeachballOptions';
import type { BumpInfo, PackageTag } from '../types/BumpInfo';
import { getPackageOption } from '../options/getPackageOption';
import { getPackagesToPublish } from '../publish/getPackagesToPublish';

/** Get a standardized package version git tag: `${name}_v${version}` */
export function generateTag(name: string, version: string): string {
  return `${name}_v${version}`;
}

/**
 * Calculate the git tag(s) that will be created for each package in `bumpInfo.packageInfos`,
 * based on `gitTags`/`getGitTag` options and per-package overrides.
 *
 * See `BumpInfo['packageTags']` for return value info.
 */
export function calculatePackageTags(
  bumpInfo: Pick<BumpInfo, 'modifiedPackages' | 'packageInfos' | 'calculatedChangeTypes' | 'scopedPackages'>,
  options: Pick<BeachballOptions, 'gitTags' | 'getGitTag'>
): BumpInfo['packageTags'] {
  const { getGitTag } = options;
  const { packageInfos } = bumpInfo;

  const packageTags: { [pkgName: string]: PackageTag[] | undefined } = {};
  // Only generate tags for the packages that are being bumped.
  // For this step, ignore shouldPublish=false.
  const packagesToPublish = getPackagesToPublish(bumpInfo, { ignoreShouldPublish: true });

  for (const pkgName of packagesToPublish) {
    const packageInfo = packageInfos[pkgName];
    const shouldTag = getPackageOption('gitTags', packageInfo, options);
    const defaultTag = generateTag(packageInfo.name, packageInfo.version);

    if (getGitTag) {
      const customTags = getGitTag(packageInfo, defaultTag);
      if (customTags) {
        const tagsArray = Array.isArray(customTags) ? customTags : [customTags];
        if (tagsArray.length) {
          packageTags[pkgName] = tagsArray.map(tag => (tag === defaultTag ? { tag } : { tag, isCustom: true }));
        }
      }
    } else if (shouldTag) {
      packageTags[pkgName] = [{ tag: defaultTag }];
    }
  }

  return packageTags;
}
