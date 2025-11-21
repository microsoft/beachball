/**
 * Indent a string by `level * 2` spaces.
 * Newlines within items will be indented to the same level.
 * @param text Text to indent
 * @param level Indent level. The number of spaces will be `level * 2`.
 * @param firstLineOffset Relative indent level for the first line (can be negative,
 * as long as `level + firstLineOffset` is 0 or greater)
 */
export function indent(text: string, level: number, firstLineOffset: number = 0): string {
  if (level < 0) {
    throw new RangeError('Level must be 0 or greater');
  }
  if (level + firstLineOffset < 0) {
    throw new RangeError('First line cannot have negative indent');
  }

  const indentString = '  '.repeat(level);
  const firstLineIndent = '  '.repeat(level + firstLineOffset);
  return text
    .split('\n')
    .map((line, i) => `${i === 0 ? firstLineIndent : indentString}${line}`)
    .join('\n');
}
