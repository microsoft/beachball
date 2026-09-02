import fs from 'node:fs';
import path from 'node:path';
import type { BeachballOptions } from '../types/BeachballOptions';
import type { PackageInfo } from '../types/PackageInfo';
import { BeachballError } from '../types/BeachballError';

/**
 * Get the directory to run `npm publish` or `npm pack` from for a package.
 * Relative configured paths are resolved from the package root.
 * @returns Absolute path to the directory to publish from.
 */
export function getPublishRoot(packageInfo: PackageInfo, options: BeachballOptions): string {
  const packageRoot = path.dirname(packageInfo.packageJsonPath);
  const configuredPublishRoot =
    typeof options.publishRoot === 'function' ? options.publishRoot({ packageRoot, options }) : options.publishRoot;

  if (configuredPublishRoot) {
    const publishRoot = path.resolve(packageRoot, configuredPublishRoot);
    const packageJsonPath = path.join(publishRoot, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      throw new BeachballError(`publishRoot does not have package.json: ${publishRoot}`);
    }
    return publishRoot;
  }

  return packageRoot;
}
