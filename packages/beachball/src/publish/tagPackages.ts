import { gitFailFast } from 'workspace-tools';
import type { BeachballOptions } from '../types/BeachballOptions';
import { getPackagesToPublish } from './getPackagesToPublish';
import { getPackageOption } from '../options/getPackageOption';

function createTag(tag: string, cwd: string): void {
  gitFailFast(['tag', '-a', '-f', tag, '-m', tag], { cwd });
}

/** Get a standardized package version git tag: `${name}_v${version}` */
export function generateTag(name: string, version: string): string {
  return `${name}_v${version}`;
}

/**
 * Create git tags for each changed package, unless the package or repo has opted out of git tags.
 * If `getGitTag` is provided, it can override or skip the default tag on a per-package basis.
 * Also, if git tags aren't disabled for the repo and the overall dist-tag (`options.tag`) has a
 * non-default value (not "latest"), create a git tag for the dist-tag.
 */
export function tagPackages(
  bumpInfo: Parameters<typeof getPackagesToPublish>[0],
  options: Pick<BeachballOptions, 'getGitTag' | 'gitTags' | 'path' | 'tag'>
): void {
  const { getGitTag, gitTags, tag: distTag, path: cwd } = options;
  const { packageInfos } = bumpInfo;

  // Reuse the getPackagesToPublish filtering logic to remove private or unchanged packages.
  // For this step, ignore shouldPublish=false.
  const packagesToPublish = getPackagesToPublish(bumpInfo, { ignoreShouldPublish: true });

  for (const pkg of packagesToPublish) {
    // Reuse the getPackagesToPublish filtering logic to remove private or unchanged packages,
    // and also exclude packages with git tags disabled (unless getGitTag can override)
    const packageInfo = packageInfos[pkg];
    const shouldTag = getPackageOption('gitTags', packageInfo, options);
    if (!shouldTag && !getGitTag) {
      continue;
    }

    const defaultTag = generateTag(packageInfo.name, packageInfo.version);

    if (getGitTag) {
      const customTags = getGitTag(packageInfo, defaultTag);
      if (customTags === null) {
        continue;
      }
      const tagsArray = Array.isArray(customTags) ? customTags : [customTags];
      for (const tag of tagsArray) {
        console.log(`Tagging - ${tag}`);
        createTag(tag, cwd);
      }
    } else if (shouldTag) {
      console.log(`Tagging - ${packageInfo.name}@${packageInfo.version}`);
      createTag(defaultTag, cwd);
    }
  }

  if (gitTags && distTag && distTag !== 'latest') {
    console.log(`Tagging - ${distTag}`);
    createTag(distTag, cwd);
  }
}
