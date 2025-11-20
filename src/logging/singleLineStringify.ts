/**
 * Format an object on a single line with spaces between the properties and brackets
 * (similar to `JSON.stringify(obj, null, 2)` but without the line breaks).
 */
export function singleLineStringify(obj: unknown): string {
  return JSON.stringify(obj, null, 2).replace(/\n\s*/g, ' ');
}
