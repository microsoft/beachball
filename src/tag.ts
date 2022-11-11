import { getOptions } from './options/getOptions';

export function generateTag(name: string, version: string) {
  const { gitTagSeparator } = getOptions(process.argv);
  return `${name}${gitTagSeparator}v${version}`;
}
