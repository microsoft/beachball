import { gitFailFast } from 'workspace-tools';
import type { BeachballOptions } from '../types/BeachballOptions';
import { getPackagesToPublish } from './getPackagesToPublish';

function createTag(tag: string, cwd: string): void {
  gitFailFast(['tag', '-a', '-f', tag, '-m', tag], { cwd });
}

/**
 * Create git tags for each changed package, based on the precomputed `bumpInfo.packageTags`
 * (which already accounts for `gitTags` and `getGitTag` options).
 *
 * Also, if `gitTags` isn't disabled for the repo and the overall dist-tag (`options.tag`) has a
 * non-default value (not "latest"), create a git tag for the dist-tag.
 */
export function tagPackages(
  bumpInfo: Parameters<typeof getPackagesToPublish>[0] & Pick<import('../types/BumpInfo').BumpInfo, 'packageTags'>,
  options: Pick<BeachballOptions, 'gitTags' | 'path' | 'tag'>
): void {
  const { gitTags, tag: distTag, path: cwd } = options;
  const { packageTags } = bumpInfo;

  // Reuse the getPackagesToPublish filtering logic to remove private or unchanged packages.
  // For this step, ignore shouldPublish=false.
  const packagesToPublish = getPackagesToPublish(bumpInfo, { ignoreShouldPublish: true });

  for (const pkg of packagesToPublish) {
    const tags = packageTags[pkg];
    if (!tags?.length) {
      continue;
    }
    for (const tag of tags) {
      console.log(`Tagging - ${tag}`);
      createTag(tag, cwd);
    }
  }

  if (gitTags && distTag && distTag !== 'latest') {
    console.log(`Tagging - ${distTag}`);
    createTag(distTag, cwd);
  }
}
