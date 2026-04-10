import { indent } from './indent';

const bulletCharacters = ['•', '▪', '◦', '▫', '-'];

export type BulletList = (string | undefined | BulletList)[];

/**
 * Writes a bulleted list of lines.
 * Newlines within items will be indented to a matching level.
 */
export function bulletedList(lines: BulletList, level = 1, bulletChar?: string): string {
  if (level < 1) {
    throw new RangeError('Level must be 1 or greater');
  }

  // The bullet used is relative to the indent level. Indent level 1 should use the first
  // bullet character, indent level 2 should use the second, etc.
  const bullet = bulletChar || bulletCharacters[(level - 1) % bulletCharacters.length];

  return lines
    .reduce((prev: string[], next: BulletList[number]): string[] => {
      if (next) {
        if (Array.isArray(next)) {
          prev.push(bulletedList(next, level + 1));
        } else {
          prev.push(indent(`${bullet} ${next}`, level + 1, -1));
        }
      }

      return prev;
    }, [] as string[])
    .join('\n');
}
