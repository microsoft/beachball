import type { GitHubRelease, ProperChangelogOptions } from './types.ts';

const maxHeadingLevel = 6;
const headingDemotion = 2;

/** Format an ISO timestamp as `YYYY-MM-DD`, or return undefined if missing/invalid. */
function formatDate(published: string | null): string | undefined {
  if (!published) {
    return undefined;
  }
  const date = new Date(published);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString().slice(0, 10);
}

/**
 * Demote ATX markdown headings (lines starting with `#`) in a release body so they nest
 * under the release's `##` section heading. Headings inside fenced code blocks are left alone.
 */
function demoteHeadings(body: string): string {
  let inFence = false;
  return body
    .split(/\r?\n/)
    .map(line => {
      const fenceMatch = line.match(/^\s*(```|~~~)/);
      if (fenceMatch) {
        inFence = !inFence;
        return line;
      }
      if (inFence) {
        return line;
      }
      const headingMatch = line.match(/^(#{1,6})(\s.*)$/);
      if (headingMatch) {
        const level = Math.min(headingMatch[1].length + headingDemotion, maxHeadingLevel);
        return '#'.repeat(level) + headingMatch[2];
      }
      return line;
    })
    .join('\n');
}

/** Find the index of a release by tag name, throwing a helpful error if not found. */
function indexOfTag(releases: GitHubRelease[], tag: string): number {
  const index = releases.findIndex(release => release.tag_name === tag);
  if (index === -1) {
    throw new Error(`No release found with tag "${tag}".`);
  }
  return index;
}

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
    const aTime = a.published_at ? Date.parse(a.published_at) : 0;
    const bTime = b.published_at ? Date.parse(b.published_at) : 0;
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

/** Render a single release as a markdown section. */
function renderRelease(release: GitHubRelease): string {
  const title = release.name?.trim() || release.tag_name;
  const date = formatDate(release.published_at);

  const lines = [`## ${title}`, ''];

  const meta: string[] = [];
  if (release.name?.trim() && release.name.trim() !== release.tag_name) {
    meta.push(`Tag [\`${release.tag_name}\`](${release.html_url})`);
  } else {
    meta.push(`[\`${release.tag_name}\`](${release.html_url})`);
  }
  if (date) {
    meta.push(`released ${date}`);
  }
  lines.push(`_${meta.join(' · ')}_`, '');

  const body = release.body?.trim();
  if (body) {
    lines.push(demoteHeadings(body), '');
  }

  return lines.join('\n').trimEnd();
}

/**
 * Render a full markdown changelog from GitHub releases, applying the given options.
 */
export function renderChangelog(releases: GitHubRelease[], options: ProperChangelogOptions): string {
  const selected = selectReleases(releases, options);
  const heading = `# ${options.repo.repo} changelog`;

  if (selected.length === 0) {
    return `${heading}\n\nNo releases found.\n`;
  }

  const sections = selected.map(renderRelease);
  return `${heading}\n\n${sections.join('\n\n')}\n`;
}
