/**
 * Format a value for display. Uses YAML-like formatting (though it may not be valid YAML):
 * - Objects use `key: value` on separate lines, no braces, no quotes around keys
 * - Arrays use `[val, val]` on a single line if they fit within `maxWidth`,
 *   otherwise use `- item` list syntax
 * - Strings are quoted, other primitives are printed as-is
 * - Functions are displayed as `(Function)`
 *
 * The returned string is indented to the given `level` (each level = 2 spaces).
 */
export function formatValue(
  value: unknown,
  options?: {
    /** Current nesting level (each level = 2 spaces of indentation) */
    level?: number;
    /** Character width limit before arrays go to multiple lines (default 80) */
    maxWidth?: number;
  }
): string {
  const { level = 0, maxWidth = 80 } = options || {};
  const pad = ' '.repeat(level * 2);

  if (value === undefined) return `${pad}undefined`;
  if (typeof value === 'function') return `${pad}(Function)`;

  // Leaf values — use JSON.stringify for strings/numbers/booleans
  if (value === null || typeof value !== 'object') {
    return `${pad}${JSON.stringify(value)}`;
  }

  const childLevel = level + 1;

  if (Array.isArray(value)) {
    if (value.length === 0) return `${pad}[]`;

    // Items are formatted at level 0 (no padding) since the array handles positioning
    const items = value.map(v => formatValue(v, { level: 0, maxWidth }));

    // Try single-line format first
    // This isn't the most efficient, but it probably doesn't matter in expected usage.
    const singleLine = `[${items.join(', ')}]`;
    if (level * 2 + singleLine.length <= maxWidth && !singleLine.includes('\n')) {
      return `${pad}${singleLine}`;
    }

    // Multi-line: YAML-like list with "- " prefix.
    // Continuation lines are indented by 2 to align with the content after "- ".
    return items.map(item => `${pad}- ${item.replace(/\n/g, `\n${pad}  `)}`).join('\n');
  }

  // Make sure it's a plain object
  if (value.constructor && value.constructor.name !== 'Object') {
    return `${pad}(${value.constructor.name})`;
  }

  // Objects: YAML-like key: value on separate lines
  const entries = Object.entries(value);
  if (entries.length === 0) return `${pad}{}`;

  return entries
    .map(([k, v]) => {
      const formattedValue = formatValue(v, { level: childLevel, maxWidth });
      const trimmedValue = formattedValue.trimStart();

      // If the value is a longer array or a structured type, place it on the next line (already padded)
      const isStructured = Array.isArray(v)
        ? !trimmedValue.startsWith('[')
        : !!v && typeof v === 'object' && trimmedValue !== '{}';
      if (isStructured) {
        return `${pad}${k}:\n${formattedValue}`;
      }
      // Inline value — strip the child padding since it goes after "key: "
      return `${pad}${k}: ${trimmedValue}`;
    })
    .join('\n');
}
