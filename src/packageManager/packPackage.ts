import fs from 'fs-extra';
import path from 'path';
import { PackageInfo } from '../types/PackageInfo';
import { BeachballOptions } from '../types/BeachballOptions';
import { npm } from './npm';
import { getNpmLogLevelArgs } from './npmArgs';

/**
 * Attempts to pack the package and move the tgz to `options.packPath`.
 * Returns a success flag and the pack file name (not full path) if successful.
 */
export async function packPackage(
  packageInfo: PackageInfo,
  options: Pick<BeachballOptions, 'packToPath' | 'verbose'>
): Promise<{ success: true; packFile: string } | { success: false }> {
  if (!options.packToPath) {
    // this is mainly to make things easier with types (not really necessary to log an error)
    return { success: false };
  }

  const packArgs = ['pack', ...getNpmLogLevelArgs(options.verbose)];

  const packageRoot = path.dirname(packageInfo.packageJsonPath);
  const packageSpec = `${packageInfo.name}@${packageInfo.version}`;
  console.log(`\nPacking - ${packageSpec}`);
  console.log(`  (cwd: ${packageRoot})`);

  const result = await npm(packArgs, {
    // Run npm pack in the package directory
    cwd: packageRoot,
    all: true,
  });
  // log afterwards instead of piping because we need to access the output to get the filename
  console.log(result.all);

  if (!result.success) {
    console.error(`\nPacking ${packageSpec} failed (see above for details)`);
    return { success: false };
  }

  const packFile = result.stdout.trim().split('\n').pop()!;
  const packFilePath = path.join(packageRoot, packFile);
  if (!packFile.endsWith('.tgz') || !fs.existsSync(packFilePath)) {
    console.error(`\nnpm pack output for ${packageSpec} (above) did not end with a filename that exists`);
    return { success: false };
  }

  const finalPackFilePath = path.join(options.packToPath, packFile);
  try {
    fs.ensureDirSync(options.packToPath);
    fs.moveSync(packFilePath, finalPackFilePath);
  } catch (err) {
    console.error(`\nFailed to move ${packFilePath} to ${finalPackFilePath}: ${err}`);
    try {
      // attempt to clean up the pack file (ignore any failures)
      fs.removeSync(packFilePath);
    } catch {}
    return { success: false };
  }

  console.log(`\nPacked ${packageSpec} to ${finalPackFilePath}`);
  return { success: true, packFile };
}
