import { BumpInfo } from '../types/BumpInfo';
import { generateTag } from '../git/generateTag';
import { gitFailFast } from 'workspace-tools';
import { BeachballOptions } from '../types/BeachballOptions';

function createTag(tag: string, cwd: string) {
  gitFailFast(['tag', '-a', '-f', tag, '-m', tag], { cwd });
}

/**
 * Create git tags for each changed package, unless the package or repo has opted out of git tags.
 * Also, if git tags aren't disabled for the repo and the overall dist-tag (`options.tag`) has a
 * non-default value (not "latest"), create a git tag for the dist-tag.
 */
export function tagPackages(bumpInfo: BumpInfo, options: Pick<BeachballOptions, 'gitTags' | 'path' | 'tag'>) {
  const { gitTags, tag: distTag, path: cwd } = options;
  const { modifiedPackages, newPackages } = bumpInfo;

  for (const pkg of [...modifiedPackages, ...newPackages]) {
    const packageInfo = bumpInfo.packageInfos[pkg];
    const changeType = bumpInfo.calculatedChangeTypes[pkg];
    // Do not tag change type of "none", private packages, or packages opting out of tagging
    if (changeType === 'none' || packageInfo.private || !packageInfo.combinedOptions.gitTags) {
      return;
    }
    console.log(`Tagging - ${packageInfo.name}@${packageInfo.version}`);
    const generatedTag = generateTag(packageInfo.name, packageInfo.version);
    createTag(generatedTag, cwd);
  }

  if (gitTags && distTag && distTag !== 'latest') {
    console.log(`Tagging - ${distTag}`);
    createTag(distTag, cwd);
  }
}
