import { BumpInfo } from '../types/BumpInfo';
import { generateTag } from '../tag';
import { gitFailFast } from '../git';

function createTag(tag: string, cwd: string) {
  gitFailFast(['tag', '-a', '-f', tag, '-m', tag], { cwd });
}

export function tagPackages(bumpInfo: BumpInfo, cwd: string) {
  const { modifiedPackages, newPackages } = bumpInfo;

  [...modifiedPackages, ...newPackages].forEach(pkg => {
    const packageInfo = bumpInfo.packageInfos[pkg];
    const changeType = bumpInfo.packageChangeTypes[pkg];
    // Do not tag change type of "none", private packages, or packages opting out of tagging
    if (changeType === 'none' || packageInfo.private || !packageInfo.options.gitTags) {
      return;
    }
    console.log(`Tagging - ${packageInfo.name}@${packageInfo.version}`);
    const generatedTag = generateTag(packageInfo.name, packageInfo.version);
    createTag(generatedTag, cwd);
  });
}

export function tagDistTag(tag: string, cwd: string) {
  if (tag && tag !== 'latest') {
    createTag(tag, cwd);
  }
}
