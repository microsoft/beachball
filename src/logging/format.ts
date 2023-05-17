export function formatList(items: string[]) {
  return items.map(item => `- ${item}`).join('\n');
}
