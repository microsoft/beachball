import { selectReleases } from './selectReleases.ts';
import type { GitHubRelease, ProperChangelogOptions } from './types.ts';

const maxHeadingLevel = 6;

/** An ATX markdown heading found in a release body. */
interface BodyHeading {
  /** Index of the heading line within the body's lines. */
  lineIndex: number;
  /** Heading level (number of leading `#` characters). */
  level: number;
  /** Heading text (without the leading `#`s or surrounding whitespace). */
  text: string;
}

/**
 * Render a full markdown changelog from GitHub releases, applying the given options.
 */
export function renderChangelog(releases: GitHubRelease[], options: ProperChangelogOptions): string {
  const selected = selectReleases(releases, options);
  const heading = `# Changelog - ${options.packageName || options.repo.repo}`;

  if (selected.length === 0) {
    return `${heading}\n\nNo releases found.\n`;
  }

  const sections = selected.map(renderRelease);
  return `${heading}\n\n${sections.join('\n\n')}\n`;
}

/** Render a single release as a markdown section. */
function renderRelease(release: GitHubRelease): string {
  const releaseName = release.name?.trim() || release.tag_name;
  const bodyLines = (release.body ?? '').replace(/\r\n/g, '\n').split('\n');

  const headings = parseHeadings(bodyLines);
  // If the body has any h1, demote every heading by one level so the highest is h2.
  const baseDemotion = headings.some(heading => heading.level === 1) ? 1 : 0;
  // Headings that sit at level 2 after applying the base demotion.
  const h2Headings = headings.filter(heading => heading.level + baseDemotion === 2);

  let sectionHeading: string;
  let demotion: number;
  let promotedLineIndex: number | undefined;

  if (h2Headings.length === 1) {
    // Use the single h2 as the section heading (don't demote any other headings).
    sectionHeading = `## ${formatSectionHeading(h2Headings[0].text, release.tag_name)}`;
    demotion = baseDemotion;
    promotedLineIndex = h2Headings[0].lineIndex;
  } else {
    // No h2 (don't demote) or multiple h2s (demote everything one more level): use the
    // release name as the section heading.
    sectionHeading = `## ${formatSectionHeading(releaseName, release.tag_name)}`;
    demotion = h2Headings.length > 1 ? baseDemotion + 1 : baseDemotion;
  }

  const lines = [sectionHeading, ''];

  const date = formatDate(release.published_at);
  const meta = [`Tag [\`${release.tag_name}\`](${release.html_url})`];
  if (date) {
    meta.push(`released ${date}`);
  }
  lines.push(`_${meta.join(' • ')}_`, '');

  const body = transformBody(bodyLines, demotion, promotedLineIndex);
  if (body) {
    lines.push(body, '');
  }

  return lines.join('\n').trimEnd();
}

/**
 * Build the section heading text from a candidate title (either a single h2 heading or the release
 * name). If the title already references the version (the tag without a leading `v`), use it as-is;
 * otherwise prefix it with the tag.
 */
function formatSectionHeading(title: string, tag: string): string {
  const tagWithoutV = tag.replace(/^v/, '');
  return title.includes(tagWithoutV) ? title : `${tag} - ${title}`;
}

/** Format an ISO timestamp as `YYYY-MM-DD`, or return undefined if missing/invalid. */
function formatDate(published: string | null): string | undefined {
  if (!published) {
    return undefined;
  }
  const date = new Date(published);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString().slice(0, 10);
}

/** Collect the ATX headings from body lines, ignoring headings inside fenced code blocks. */
function parseHeadings(lines: string[]): BodyHeading[] {
  const headings: BodyHeading[] = [];
  let inFence = false;
  lines.forEach((line, lineIndex) => {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      return;
    }
    if (inFence) {
      return;
    }
    const match = line.match(/^(#{1,6})\s+(.*\S)\s*$/);
    if (match) {
      headings.push({ lineIndex, level: match[1].length, text: match[2] });
    }
  });
  return headings;
}

/**
 * Rebuild a release body, demoting ATX headings by `demotion` levels (headings inside fenced
 * code blocks are left alone) and optionally removing the heading promoted to the section heading.
 */
function transformBody(lines: string[], demotion: number, promotedLineIndex?: number): string {
  let inFence = false;
  const out: string[] = [];
  lines.forEach((line, lineIndex) => {
    if (lineIndex === promotedLineIndex) {
      return;
    }
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      out.push(line);
      return;
    }
    if (!inFence && demotion > 0) {
      const match = line.match(/^(#{1,6})(\s.*)$/);
      if (match) {
        const level = Math.min(match[1].length + demotion, maxHeadingLevel);
        out.push('#'.repeat(level) + match[2]);
        return;
      }
    }
    out.push(line);
  });
  return out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
