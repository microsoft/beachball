import picomatch, { type Matcher, type PicomatchOptions } from 'picomatch';

/**
 * Use picomatch to check if a package path should be included.
 * @param relativePath Relative path to check.
 */
export function isPathIncluded(params: {
  /** Relative path to the package from the repo root. */
  relativePath: string;
  /** Include pattern(s). If `true`, include all paths except those excluded. */
  include: string | string[] | true;
  /** Exclude pattern(s). */
  exclude?: string | string[];
}): boolean {
  const { relativePath, include, exclude } = params;

  let shouldInclude: boolean;
  if (include === true) {
    shouldInclude = true;
  } else {
    shouldInclude = makeGlobMatcher(include)(relativePath);
  }

  if (exclude?.length && shouldInclude) {
    shouldInclude = !makeGlobMatcher(exclude)(relativePath);
  }

  return shouldInclude;
}

/**
 * Make a picomatch glob matcher for the given pattern, with appropriate options for
 * checking for matches against files (not directories).
 */
export function makeFileGlobMatcher(pattern: string): Matcher {
  return makeGlobMatcher(pattern, {
    dot: true,
    // picomatch matchBase behavior is different from minimatch, so we only set the option if
    // there are no slashes to get the desired behavior.
    // https://github.com/micromatch/picomatch/issues/136
    matchBase: !pattern.includes('/'),
  });
}

/**
 * Make a picomatch glob matcher for the given pattern(s).
 * It will automatically set `windows` (match backslashes as forward slashes) on Windows.
 */
function makeGlobMatcher(patterns: string | string[], options?: PicomatchOptions): Matcher {
  return picomatch(patterns, {
    windows: process.platform === 'win32',
    ...options,
  });
}
