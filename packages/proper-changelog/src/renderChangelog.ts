import { selectReleases } from './selectReleases.ts';
import type { GitHubRelease, ProperChangelogOptions } from './types.ts';

const maxHeadingLevel = 6;
const headingDemotion = 2;

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

/** Render a single release as a markdown section. */
function renderRelease(release: GitHubRelease): string {
  const title = release.name?.trim() || release.tag_name;
  const date = formatDate(release.published_at);

  const lines = [`## ${title}`, ''];

  const meta = [`Tag [\`${release.tag_name}\`](${release.html_url})`];
  if (date) {
    meta.push(`released ${date}`);
  }
  lines.push(`_${meta.join(' • ')}_`, '');

  const body = release.body?.trim();
  if (body) {
    lines.push(demoteHeadings(body), '');
  }

  return lines.join('\n').trimEnd();
}

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
