import semver from 'semver';
import type { ChangeType } from '../types/ChangeInfo';
import type { BeachballOptions } from '../types/BeachballOptions';

export interface GetPrereleaseVersionParams {
  /** The package's current `package.json` version (may be a prerelease). */
  currentVersion: string;
  /** The aggregate change type for this package (from change files). */
  changeType: ChangeType;
  /** Suffix to use, e.g. `'beta'`, `'canary'`, `'pr30'`. */
  prereleasePrefix: string;
  /**
   * `'0'` (default) starts at `.0`, `'1'` starts at `.1`, `false` omits the numeric counter.
   */
  identifierBase?: BeachballOptions['identifierBase'];
  /** Existing published versions of the package, used to find the next available counter. */
  existingVersions: string[];
}

/**
 * Calculate the next prerelease version for a package, based on its current version,
 * the aggregate change type from change files, and the versions already published.
 *
 * Algorithm:
 * 1. Strip any prerelease component from `currentVersion`.
 * 2. Apply `changeType` (or pass through for `'none'`) to get the target release version.
 * 3. Find the highest counter `N` among published versions matching
 *    `${target}-${prereleasePrefix}.<number>` and return `${target}-${prereleasePrefix}.<N+1>`.
 *    (Or `<base>` from `identifierBase` if no matching versions exist.)
 *
 * When `identifierBase: false` and the resulting non-numeric version already exists,
 * an error is thrown (the caller should suggest using `identifierBase: '0'` instead).
 */
export function getPrereleaseVersion(params: GetPrereleaseVersionParams): string {
  const { currentVersion, changeType, prereleasePrefix, identifierBase, existingVersions } = params;

  if (!prereleasePrefix) {
    throw new Error('prereleasePrefix is required to compute a prerelease version');
  }

  // Strip any existing prerelease component so the bump operates on the underlying release.
  const baseVersion = stripPrerelease(currentVersion);

  // Compute the target release version. For 'none', stay on the current release.
  let targetRelease: string;
  if (changeType === 'none') {
    targetRelease = baseVersion;
  } else {
    const incremented = semver.inc(baseVersion, changeType);
    if (!incremented) {
      throw new Error(`Failed to compute target version from "${currentVersion}" with change type "${changeType}"`);
    }
    targetRelease = incremented;
  }

  if (identifierBase === false) {
    const candidate = `${targetRelease}-${prereleasePrefix}`;
    if (existingVersions.includes(candidate)) {
      throw new Error(
        `Prerelease version "${candidate}" already exists in the registry. ` +
          `Set "identifierBase" to "0" or "1" to enable an auto-incrementing counter for prereleases.`
      );
    }
    return candidate;
  }

  // Find the next counter among existing versions matching `${target}-${prefix}.<n>`.
  const prefixWithDot = `${targetRelease}-${prereleasePrefix}.`;
  let maxCounter = -1;
  for (const existing of existingVersions) {
    if (existing.startsWith(prefixWithDot)) {
      const rest = existing.slice(prefixWithDot.length);
      // Only accept a single numeric component (no further build metadata or extra dots).
      if (/^\d+$/.test(rest)) {
        const n = parseInt(rest, 10);
        if (n > maxCounter) maxCounter = n;
      }
    }
  }

  if (maxCounter === -1) {
    // No existing matching prerelease - use the configured starting counter.
    const startBase = identifierBase === '1' ? 1 : 0;
    return `${targetRelease}-${prereleasePrefix}.${startBase}`;
  }

  return `${targetRelease}-${prereleasePrefix}.${maxCounter + 1}`;
}

/**
 * Return the version with any prerelease/build component stripped.
 * `1.2.3-beta.4` -> `1.2.3`
 * `1.2.3` -> `1.2.3`
 */
function stripPrerelease(version: string): string {
  const parsed = semver.parse(version);
  if (!parsed) {
    throw new Error(`Invalid semver version: "${version}"`);
  }
  return `${parsed.major}.${parsed.minor}.${parsed.patch}`;
}
