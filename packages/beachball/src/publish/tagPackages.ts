import { BumpInfo } from '../types/BumpInfo';
import { generateTag } from '../tag';
import { gitFailFast } from '../git';

function createTag(tag: string, cwd: string) {
  gitFailFast(['tag', '-a', '-f', tag, '-m', tag], { cwd });
}

export function tagPackages(bumpInfo: BumpInfo, gitTags: boolean, tag: string, cwd: string) {
  const { modifiedPackages, newPackages } = bumpInfo;

  if (gitTags) {
    [...modifiedPackages, ...newPackages].forEach(pkg => {
      const packageInfo = bumpInfo.packageInfos[pkg];
      const changeType = bumpInfo.packageChangeTypes[pkg];
      // Do not tag change type of "none" or private packages
      if (changeType === 'none' || packageInfo.private) {
        return;
      }
      console.log(`Tagging - ${packageInfo.name}@${packageInfo.version}`);
      const generatedTag = generateTag(packageInfo.name, packageInfo.version);
      createTag(generatedTag, cwd);
    });
    // Adds a special dist-tag based tag in git
    if (tag && tag !== 'latest') {
      createTag(tag, cwd);
    }
  }
}
