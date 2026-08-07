import path from 'node:path';
import type { BeachballOptions } from '../types/BeachballOptions';

/**
 * Filter `filePaths` to exclude any paths matching `ignorePatterns`.
 */
export function filterIgnoredFiles(
  params: Pick<BeachballOptions, 'ignorePatterns'> & {
    /** Relative file paths */
    filePaths: string[] | Set<string>;
    /** If specified, called for each ignored file */
    logIgnored?: (filePath: string, reason: string) => void;
  }
): string[] {
  const { filePaths, ignorePatterns, logIgnored } = params;
  if (!ignorePatterns?.length) {
    return Array.isArray(filePaths) ? filePaths : [...filePaths];
  }

  const filtered: string[] = [];
  for (const filePath of filePaths) {
    const basename = path.basename(filePath);
    // Emulate the minimatch `matchBase` option:
    // - Patterns without a slash are matched against the basename, even if under a .dot directory.
    // - Patterns containing a slash are matched as-is, relative to the repo root.
    // (Node sets windowsPathsNoEscape to treat \ exclusively as a path separator.)
    // https://github.com/nodejs/node/blob/6a3d80fb49c50494fe987a22708634ce720e9272/lib/internal/fs/glob.js#L112
    const ignorePattern = ignorePatterns.find(pattern =>
      path.matchesGlob(pattern.includes('/') || pattern.includes('\\') ? filePath : basename, pattern)
    );

    if (ignorePattern) {
      logIgnored?.(filePath, `ignored by pattern "${ignorePattern}"`);
    } else {
      filtered.push(filePath);
    }
  }
  return filtered;
}
