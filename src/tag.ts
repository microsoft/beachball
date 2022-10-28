import { getOptions } from './options/getOptions';

export function generateTag(name: string, version: string) {
  const changeTagHyphen = getOptions(process.argv).changeTagHyphen;
  return `${name}${changeTagHyphen}v${version}`;
}
