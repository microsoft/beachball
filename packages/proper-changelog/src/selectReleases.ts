import { ChangelogError, type GitHubRelease, type ProperChangelogOptions } from './types.ts';

export type SelectReleasesOptions = Pick<
  ProperChangelogOptions,
  'includePrereleases' | 'filter' | 'since' | 'from' | 'to' | 'limit'
>;

/**
 * Filter, sort, and slice releases according to the provided options.
 * Draft releases are always excluded; prereleases are excluded unless `includePrereleases`.
 * Releases are returned newest-first by published date.
 */
export function selectReleases(releases: GitHubRelease[], options: SelectReleasesOptions): GitHubRelease[] {
  let selected = releases.filter(release => !release.draft);

  if (!options.includePrereleases) {
    selected = selected.filter(release => !release.prerelease);
  }

  if (options.filter) {
    const matchesTag = makeTagMatcher(options.filter);
    selected = selected.filter(release => matchesTag(release.tag_name));
  }

  if (options.since) {
    const sinceTime = options.since.getTime();
    selected = selected.filter(release => {
      const time = release.published_at ? new Date(release.published_at).getTime() : NaN;
      return !Number.isNaN(time) && time > sinceTime;
    });
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
    throw new ChangelogError(`No release found with tag "${tag}".`);
  }
  return index;
}

/**
 * Build a tag-matching predicate from a filter. A `RegExp` matches tags that satisfy it;
 * a string matches tags that contain it (case-insensitive).
 */
function makeTagMatcher(filter: string | RegExp): (tag: string) => boolean {
  if (filter instanceof RegExp) {
    return tag => filter.test(tag);
  }

  const needle = filter.toLowerCase();
  return tag => tag.toLowerCase().includes(needle);
}
