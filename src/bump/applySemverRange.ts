import { CliOptions } from '../types/BeachballOptions';

export function applySemverRange(range: CliOptions['replaceStars'], versionString: string): string {
  if (!versionString.startsWith('^') && range === 'caret') {
    return `^${versionString}`;
  } else if (!versionString.startsWith('~') && range === 'tilde') {
    return `~${versionString}`;
  }

  return versionString;
}