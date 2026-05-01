import type { BeachballOptions } from '../types/BeachballOptions';
import type { PackageInfo, ScopedPackages } from '../types/PackageInfo';

/**
 * Determines whether the package is included in the list of potentially-changed published packages,
 * based on private flags and scopedPackages.
 *
 * (All the reasons except nonexistent include the package name.)
 */
export function isPackageIncluded(
  packageInfo: PackageInfo | undefined,
  scopedPackages: ScopedPackages
): { isIncluded: boolean; reason: string } {
  const reason = !packageInfo
    ? 'no corresponding package found'
    : packageInfo.private
      ? `${packageInfo.name} is private`
      : // This is a package-only option (can't be set at repo level or via CLI)
        packageInfo.packageOptions?.shouldPublish === false
        ? `${packageInfo.name} has beachball.shouldPublish=false`
        : !scopedPackages.has(packageInfo.name)
          ? `${packageInfo.name} is out of scope`
          : ''; // not ignored

  return { isIncluded: !reason, reason };
}

export function getIncludedLoggers(options: Pick<BeachballOptions, 'verbose'>): {
  verboseLog: (msg: string) => void;
  logIgnored: (name: string, reason: string) => void;
  logIncluded: (name: string) => void;
} {
  const verboseLog = (msg: string) => options.verbose && console.log(msg);
  return {
    verboseLog,
    logIgnored: (name, reason) => verboseLog(`  - ~~${name}~~ (${reason})`),
    logIncluded: name => verboseLog(`  - ${name}`),
  };
}
