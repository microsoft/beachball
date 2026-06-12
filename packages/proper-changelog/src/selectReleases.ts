import type { GitHubRelease, ProperChangelogOptions } from './types.ts';

/**
 * Filter, sort, and slice releases according to the provided options.
 * Draft releases are always excluded; prereleases are excluded unless `includePrereleases`.
 * Releases are returned newest-first by published date.
 */
export function selectReleases(releases: GitHubRelease[], options: ProperChangelogOptions): GitHubRelease[] {
  let selected = releases.filter(release => !release.draft);

  if (!options.includePrereleases) {
    selected = selected.filter(release => !release.prerelease);
  }

  selected.sort((a, b) => {
    const aTime = (a.published_at && Date.parse(a.published_at)) || 0;
    const bTime = (b.published_at && Date.parse(b.published_at)) || 0;
    return bTime - aTime;
  });

  // Apply the `from`/`to` tag range (inclusive, order-independent).
  if (options.from || options.to) {
    const bounds = [
      options.from !== undefined ? indexOfTag(selected, options.from) : 0,
      options.to !== undefined ? indexOfTag(selected, options.to) : selected.length - 1,
    ];
    const start = Math.min(...bounds);
    const end = Math.max(...bounds);
    selected = selected.slice(start, end + 1);
  }

  if (options.limit !== undefined && options.limit >= 0) {
    selected = selected.slice(0, options.limit);
  }

  return selected;
}

/** Find the index of a release by tag name, throwing a helpful error if not found. */
function indexOfTag(releases: GitHubRelease[], tag: string): number {
  const index = releases.findIndex(release => release.tag_name === tag);
  if (index === -1) {
    throw new Error(`No release found with tag "${tag}".`);
  }
  return index;
}
