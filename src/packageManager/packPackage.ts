import fs from 'fs';
import path from 'path';
import type { PackageInfo } from '../types/PackageInfo';
import type { BeachballOptions } from '../types/BeachballOptions';
import { npm } from './npm';
import { getNpmLogLevelArgs } from './npmArgs';

/**
 * Attempts to pack the package and move the tgz to `options.packPath`.
 * Depending on `packInfo.packStyle`, either the filename will be prefixed with a number,
 * or it will be put in a numbered folder.
 * @returns true if successful, false if not.
 */
export async function packPackage(
  packageInfo: PackageInfo,
  options: Required<Pick<BeachballOptions, 'packToPath'>> &
    Pick<BeachballOptions, 'verbose'> & {
      packInfo:
        | {
            /** Index of this package in the topologically-sorted list to publish */
            index: number;
            /** Total number of packages to publish */
            total: number;
          }
        | {
            /** Array of layers of package names returned by `getPancakes` */
            pancakes: string[][];
          };
    }
): Promise<boolean> {
  const { packToPath, verbose, packInfo } = options;

  const packArgs = ['pack', ...getNpmLogLevelArgs(verbose)];

  const packageRoot = path.dirname(packageInfo.packageJsonPath);
  const packageSpec = `${packageInfo.name}@${packageInfo.version}`;
  console.log(`Packing - ${packageSpec}`);
  console.log(`  (cwd: ${packageRoot})\n`);

  // Run npm pack in the package directory
  const result = await npm(packArgs, { cwd: packageRoot, all: true });
  // log afterwards instead of piping because we need to access the output to get the filename
  console.log((result.all || '') + '\n');

  if (!result.success) {
    console.error(`Packing ${packageSpec} failed (see above for details)\n`);
    return false;
  }

  const packFile = result.stdout.trim().split('\n').pop() || '';
  const packFilePath = path.join(packageRoot, packFile);
  if (!packFile.endsWith('.tgz') || !fs.existsSync(packFilePath)) {
    console.error(`npm pack output for ${packageSpec} (above) did not end with a filename that exists\n`);
    return false;
  }

  // Prepend a numeric prefix to the pack file (0-padded so basic sorting works).
  // Or for packStyle: "pancake", put the pack file in a subfolder for its dependency tree layer.
  // The prefix isn't strictly needed for single packages, but use it for consistency in case of a
  // monorepo which usually publishes multiple packages but sometimes only one has changed.
  let finalPackFilePath: string;
  if ('pancakes' in packInfo) {
    const { pancakes } = packInfo;
    const packageLayer = pancakes.findIndex(layer => layer.includes(packageInfo.name));
    if (packageLayer === -1) {
      console.error(`Internal error: package ${packageInfo.name} not found in order of packages to publish\n`);
      return false;
    }
    const layerDir = makePrefix({ num: packageLayer, total: pancakes.length });
    finalPackFilePath = path.join(packToPath, layerDir, packFile);
  } else {
    const packPrefix = makePrefix({ num: packInfo.index, total: packInfo.total });
    finalPackFilePath = path.join(packToPath, `${packPrefix}-${packFile}`);
  }

  try {
    if (fs.existsSync(finalPackFilePath)) {
      throw new Error('Target path already exists');
    }
    fs.mkdirSync(path.dirname(finalPackFilePath), { recursive: true });
    fs.renameSync(packFilePath, finalPackFilePath);
  } catch (err) {
    console.error(`Failed to move ${packFilePath} to ${finalPackFilePath}: ${err}\n`);
    try {
      // attempt to clean up the pack file (ignore any failures)
      fs.rmSync(packFilePath);
    } catch {
      // ignore
    }
    return false;
  }

  console.log(`Packed ${packageSpec} to ${finalPackFilePath}`);
  return true;
}

/**
 * Convert `num` from 0- to 1-indexed and pad with leading zeros based on the total.
 */
function makePrefix(params: { num: number; total: number }): string {
  const { num, total } = params;
  return String(num + 1).padStart(String(total).length, '0');
}
