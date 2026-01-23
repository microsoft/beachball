import minimatch from 'minimatch';
import type { BeachballOptions } from '../types/BeachballOptions';

const minimatchOptions: minimatch.IOptions = { matchBase: true };

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

  return filePaths.filter(filePath => {
    const ignorePattern = ignorePatterns.find(pattern => minimatch(filePath, pattern, minimatchOptions));
    ignorePattern && logIgnored?.(filePath, `ignored by pattern "${ignorePattern}"`);
    return !ignorePattern;
  });
}
