import { generateTag } from '../git/generateTag';
import { gitFailFast } from 'workspace-tools';
import type { BeachballOptions } from '../types/BeachballOptions';
import { getPackagesToPublish } from './getPackagesToPublish';
import { getPackageOption } from '../options/getPackageOption';

function createTag(tag: string, cwd: string): void {
  gitFailFast(['tag', '-a', '-f', tag, '-m', tag], { cwd });
}

/**
 * Create git tags for each changed package, unless the package or repo has opted out of git tags.
 * Also, if git tags aren't disabled for the repo and the overall dist-tag (`options.tag`) has a
 * non-default value (not "latest"), create a git tag for the dist-tag.
 */
export function tagPackages(
  bumpInfo: Parameters<typeof getPackagesToPublish>[0],
  options: Pick<BeachballOptions, 'gitTags' | 'path' | 'tag'>
): void {
  const { gitTags, tag: distTag, path: cwd } = options;
  const { packageInfos } = bumpInfo;

  // Reuse the getPackagesToPublish filtering logic to remove private or unchanged packages,
  // and also exclude packages with git tags disabled
  const filteredPackages = getPackagesToPublish(bumpInfo).filter(pkg =>
    getPackageOption('gitTags', packageInfos[pkg], options)
  );

  for (const pkg of filteredPackages) {
    const packageInfo = packageInfos[pkg];
    console.log(`Tagging - ${packageInfo.name}@${packageInfo.version}`);
    const generatedTag = generateTag(packageInfo.name, packageInfo.version);
    createTag(generatedTag, cwd);
  }

  if (gitTags && distTag && distTag !== 'latest') {
    console.log(`Tagging - ${distTag}`);
    createTag(distTag, cwd);
  }
}
