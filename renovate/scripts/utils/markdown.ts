/** Marker comments for a section */
export type Comments = { start: string; end: string };

/**
 * Get marker comments wrapping a section
 */
export function getComments(desc: string, extraStartDesc?: string): Comments {
  return {
    start: `<!-- start ${desc}${extraStartDesc ? ` (${extraStartDesc})` : ''} -->`,
    end: `<!-- end ${desc} -->`,
  };
}

/**
 * Get section content between marker comments
 */
export function getMarkedSection(text: string, comments: Comments): string {
  return text.split(comments.start)[1].split(comments.end)[0].trim();
}

/**
 * Get the text under each heading of the given level
 */
export function splitByHeading(text: string, level: number): string[] {
  return text.trim().split(new RegExp(`^(?=${'#'.repeat(level)} .*\n)`, 'gm'));
}

/**
 * Get the text of the first heading of the given level (excluding the `#`s)
 */
export function getHeadingText(text: string, level: number): string {
  return (text.match(new RegExp(`^${'#'.repeat(level)} (.*)`, 'm')) || [])[1]?.trim() || '';
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/ /g, '-')
    .replace(/[^\w-]/g, '');
}
