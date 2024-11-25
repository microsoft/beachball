import type { BeachballOptions } from '../types/BeachballOptions';
import { makeFileGlobMatcher } from './isPathIncluded';

/**
 * Filter `filePaths` to exclude any paths matching `ignorePatterns`.
 */
export function filterIgnoredFiles(
  params: Pick<BeachballOptions, 'ignorePatterns'> & {
    /** Relative file paths */
    filePaths: string[];
    /** If specified, called for each ignored file */
    logIgnored?: (filePath: string, reason: string) => void;
  }
): string[] {
  const { filePaths, ignorePatterns, logIgnored } = params;
  if (!ignorePatterns?.length) {
    return filePaths;
  }

  const ignoreMatchers = Object.fromEntries(
    // Pre-create a matcher for each pattern for efficiency
    ignorePatterns.map(pattern => [pattern, makeFileGlobMatcher(pattern)])
  );

  return filePaths.filter(filePath => {
    const [ignorePattern] = Object.entries(ignoreMatchers).find(([_pattern, matcher]) => matcher(filePath)) || [];
    ignorePattern && logIgnored?.(filePath, `ignored by pattern "${ignorePattern}"`);
    return !ignorePattern;
  });
}
