import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { BeachballOptions } from '../types/BeachballOptions';

interface ChangelogPaths {
  /** Absolute path to changelog md file (new or existing), if it should be generated. */
  md?: string;
  /** Absolute path to changelog json file (new or existing), if it should be generated. */
  json?: string;
}

/**
 * Get the paths to the changelog files. Also handles conversion between `changelog.uniqueFilenames`
 * being true and false/unset (moving the files if needed).
 *
 * @returns object with each changelog path, or undefined if that changelog shouldn't be written.
 */
export function prepareChangelogPaths(params: {
  options: Pick<BeachballOptions, 'changelog' | 'generateChangelog'>;
  packageName: string;
  /** cwd where changelogs are located */
  changelogAbsDir: string;
}): ChangelogPaths {
  const { options, changelogAbsDir: cwd, packageName } = params;
  const { changelog, generateChangelog } = options;
  const { uniqueFilenames } = changelog || {};

  const paths: ChangelogPaths = {};

  if (!generateChangelog) {
    return paths;
  }

  for (const ext of ['md', 'json'] as const) {
    if (generateChangelog !== true && generateChangelog !== ext) {
      continue; // not generating this file type
    }

    const defaultPath = path.join(cwd, `CHANGELOG.${ext}`);

    // Generate a unique filename based on the package name hash.
    const hash = crypto.createHash('md5').update(packageName).digest('hex').slice(0, 8);
    const pathWithHash = path.join(cwd, `CHANGELOG-${hash}.${ext}`);

    // Choose the changelog file path based on whether unique filenames are enabled.
    const filePath = (paths[ext] = uniqueFilenames ? pathWithHash : defaultPath);

    if (!fs.existsSync(filePath)) {
      // The path to use doesn't exist--check if the other path does, and if so, rename it.
      const renamed = renameIfPresent({
        oldPath: uniqueFilenames ? defaultPath : pathWithHash,
        newPath: filePath,
      });

      if (!renamed) {
        // Neither path exists. Check for other hashed changelog files in case the package was renamed.
        // (If there's no other hashed file, it's the first changelog entry for this package.)
        const existingHashedPath = getExistingHashedPath({ cwd, ext });
        if (existingHashedPath) {
          renameIfPresent({ oldPath: existingHashedPath, newPath: filePath });
        }
      }
    }
  }

  return paths;
}

/**
 * Get the path to the newest `CHANGELOG-{hash}.{ext}` file in the given directory.
 */
function getExistingHashedPath(params: { cwd: string; ext: 'md' | 'json' }): string | undefined {
  const { cwd, ext } = params;
  const fileRegexp = new RegExp(`^CHANGELOG-[a-f\\d]{8}\\.${ext}$`);
  try {
    let newestDate = 0;
    let newestFile: string | undefined;

    for (const file of fs.readdirSync(cwd)) {
      if (!fileRegexp.test(file)) {
        continue;
      }

      const date = fs.statSync(path.join(cwd, file)).mtimeMs;
      if (date > newestDate) {
        newestDate = date;
        newestFile = file;
      }
    }
    return newestFile ? path.join(cwd, newestFile) : undefined;
  } catch (e) {
    console.warn(`Error getting changelog file info in ${cwd}: ${e}`);
  }
}

function renameIfPresent(params: { oldPath: string; newPath: string }): boolean {
  const { oldPath, newPath } = params;
  try {
    if (fs.existsSync(oldPath)) {
      fs.renameSync(oldPath, newPath);
      console.log(`Renamed existing changelog file ${oldPath} to ${path.basename(newPath)}`);
      return true;
    }
  } catch (e) {
    console.warn(`Error renaming changelog file ${oldPath} to ${path.basename(newPath)}: ${e}`);
  }
  return false;
}
