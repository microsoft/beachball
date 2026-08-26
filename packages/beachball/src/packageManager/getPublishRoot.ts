import path from 'node:path';
import type { BeachballOptions } from '../types/BeachballOptions';
import type { PackageInfo } from '../types/PackageInfo';

/**
 * Get the directory to run `npm publish` or `npm pack` from for a package.
 * Relative configured paths are resolved from the package root.
 * @returns Absolute path to the directory to publish from.
 */
export function getPublishRoot(packageInfo: PackageInfo, options: BeachballOptions): string {
  const packageRoot = path.dirname(packageInfo.packageJsonPath);
  const configuredPublishRoot =
    typeof options.publishRoot === 'function'
      ? options.publishRoot({ packagePath: packageRoot, options })
      : options.publishRoot;

  return configuredPublishRoot ? path.resolve(packageRoot, configuredPublishRoot) : packageRoot;
}
