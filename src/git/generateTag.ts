/** Get a standardized package version git tag: `${name}_v${version}` */
export function generateTag(name: string, version: string) {
  return `${name}_v${version}`;
}
