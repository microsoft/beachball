import { gitFailFast } from 'workspace-tools';
import type { BeachballOptions } from '../types/BeachballOptions';
import type { BumpInfo } from '../types/BumpInfo';

function createTag(tag: string, cwd: string): void {
  gitFailFast(['tag', '-a', '-f', tag, '-m', tag], { cwd });
}

/**
 * Create the precomputed git tags in `bumpInfo.packageTags`.
 * The map already accounts for `gitTags` and `getGitTag` options.
 */
export function tagPackages(packageTags: BumpInfo['packageTags'], options: Pick<BeachballOptions, 'path'>): void {
  const { path: cwd } = options;

  // Dedupe the tags in case multiple packages use a shared secondary tag
  const tags = Object.values(packageTags)
    .flat()
    .map(entry => entry?.tag);
  for (const tag of new Set(tags)) {
    if (tag) {
      console.log(`Tagging - ${tag}`);
      createTag(tag, cwd);
    }
  }
}
