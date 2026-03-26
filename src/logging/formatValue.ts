/**
 * Format a value for display. Sort of like JSON.stringify but handles additional types that
 * can be in the beachball config, uses single-line format when the result fits within `widthLimit`,
 * and does not quote property names that are obviously-valid identifiers.
 */
export function formatValue(
  value: unknown,
  options?: {
    /** Current indentation level (NOT the number of spaces) */
    indent?: number;
    /** Character width limit before going to multiple lines */
    widthLimit?: number;
  }
): string {
  const { indent = 0, widthLimit = 80 } = options || {};

  if (value === undefined) return 'undefined';
  if (typeof value === 'function') return '[Function]';

  // Leaf values — use JSON.stringify
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  const childOpts = { indent: indent + 2, widthLimit };
  const pad = ' '.repeat(indent + 2);
  const closePad = ' '.repeat(indent);

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';

    // For now, take a simple approach of checking the width by creating the complete formatted value.
    // This isn't efficient, but it probably doesn't matter in expected usage.
    const items = value.map(v => formatValue(v, childOpts));
    const singleLine = `[${items.join(', ')}]`;
    if (indent + singleLine.length <= widthLimit && !singleLine.includes('\n')) {
      return singleLine;
    }
    return `[\n${items.map(item => `${pad}${item}`).join(',\n')}\n${closePad}]`;
  }

  const entries = Object.entries(value);
  if (entries.length === 0) return '{}';

  // Same comment as above about efficiency
  const formatted = entries.map(
    ([k, v]) => [/[^\w$]/.test(k) ? JSON.stringify(k) : k, formatValue(v, childOpts)] as const
  );
  const singleLine = `{ ${formatted.map(([k, v]) => `${k}: ${v}`).join(', ')} }`;
  if (indent + singleLine.length <= widthLimit && !singleLine.includes('\n')) {
    return singleLine;
  }
  return `{\n${formatted.map(([k, v]) => `${pad}${k}: ${v}`).join(',\n')}\n${closePad}}`;
}
