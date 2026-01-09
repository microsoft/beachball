import fs from 'fs';
import path from 'path';
import type { PackageInfo } from '../types/PackageInfo';
import type { BeachballOptions } from '../types/BeachballOptions';
import { npm } from './npm';
import { getNpmLogLevelArgs } from './npmArgs';

/**
 * Attempts to pack the package and move the tgz to `options.packPath`.
 * The packed filename will be prefixed with a number.
 * @returns true if successful, false if not.
 */
export async function packPackage(
  packageInfo: PackageInfo,
  options: Required<Pick<BeachballOptions, 'packToPath'>> &
    Pick<BeachballOptions, 'verbose'> & {
      /** Index of this package in the topologically-sorted list to publish */
      index: number;
      /** Total number of packages to publish */
      total: number;
    }
): Promise<boolean> {
  const { packToPath, verbose, index, total } = options;

  const packArgs = ['pack', ...getNpmLogLevelArgs(verbose)];

  const packageRoot = path.dirname(packageInfo.packageJsonPath);
  const packageSpec = `${packageInfo.name}@${packageInfo.version}`;
  console.log(`\nPacking - ${packageSpec}`);
  console.log(`  (cwd: ${packageRoot})`);

  // Run npm pack in the package directory
  const result = await npm(packArgs, { cwd: packageRoot, all: true });
  // log afterwards instead of piping because we need to access the output to get the filename
  console.log(result.all);

  if (!result.success) {
    console.error(`\nPacking ${packageSpec} failed (see above for details)`);
    return false;
  }

  const packFile = result.stdout.trim().split('\n').pop() || '';
  const packFilePath = path.join(packageRoot, packFile);
  if (!packFile.endsWith('.tgz') || !fs.existsSync(packFilePath)) {
    console.error(`\nnpm pack output for ${packageSpec} (above) did not end with a filename that exists`);
    return false;
  }

  // Prepend a numeric prefix to the pack file (0-padded so basic sorting works).
  // The prefix isn't strictly needed for single packages, but use it for consistency in case of a
  // monorepo which usually publishes multiple packages but sometimes only one has changed.
  const packPrefix = String(index + 1).padStart(String(total).length, '0') + '-';
  const finalPackFilePath = path.join(packToPath, packPrefix + packFile);
  try {
    if (fs.existsSync(finalPackFilePath)) {
      throw new Error('Target path already exists');
    }
    fs.mkdirSync(packToPath, { recursive: true });
    fs.renameSync(packFilePath, finalPackFilePath);
  } catch (err) {
    console.error(`\nFailed to move ${packFilePath} to ${finalPackFilePath}: ${err}`);
    try {
      // attempt to clean up the pack file (ignore any failures)
      fs.rmSync(packFilePath);
    } catch {
      // ignore
    }
    return false;
  }

  console.log(`\nPacked ${packageSpec} to ${finalPackFilePath}`);
  return true;
}
