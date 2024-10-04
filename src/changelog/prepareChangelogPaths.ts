import fs from 'fs';
import path from 'path';
import { v4 as uuid } from 'uuid';
import type { BeachballOptions } from '../types/BeachballOptions';

interface ChangelogPaths {
  /** Absolute path to changelog md file (new or existing) */
  md?: string;
  /** Absolute path to changelog json file (new or existing) */
  json?: string;
  /** Hash being used in files, if any */
  hash?: string;
}

/**
 * Get the paths to the changelog files. Also handles conversion between `changelog.hashFilenames`
 * being true and false/unset (moving the files if needed).
 *
 * @returns object with each changelog path, or undefined if that changelog shouldn't be written.
 */
export function prepareChangelogPaths(params: {
  options: Pick<BeachballOptions, 'changelog' | 'generateChangelog'>;
  /** cwd where changelogs are located */
  changelogAbsDir: string;
}): ChangelogPaths {
  const { options, changelogAbsDir: cwd } = params;
  const { changelog, generateChangelog } = options;
  const { hashFilenames } = changelog || {};

  const paths: ChangelogPaths = {};
  let existingHashedPaths: ChangelogPaths | undefined;

  if (!generateChangelog) {
    return paths;
  }

  for (const ext of ['md', 'json'] as const) {
    if (generateChangelog !== true && generateChangelog !== ext) {
      continue; // not generating this file type
    }

    const defaultPath = path.join(cwd, `CHANGELOG.${ext}`);

    if (hashFilenames) {
      // Filenames should be hashed. Start by getting any existing hashed changelogs...
      existingHashedPaths ??= _getExistingHashedChangelogs(cwd);
      // Use the existing hash or generate a new one
      paths.hash ??= existingHashedPaths.hash ?? uuid().slice(0, 8);

      if (existingHashedPaths[ext]) {
        // Hashed file already exists, so use it
        paths[ext] = existingHashedPaths[ext];
      } else {
        // New hashed file
        paths[ext] = path.join(cwd, `CHANGELOG-${paths.hash}.${ext}`);
        // Move any existing non-hashed file to the new hashed path
        moveIfNeeded({ oldPath: defaultPath, newPath: paths[ext]!, wasHashed: false });
      }
    } else {
      // Filenames should not be hashed
      paths[ext] = defaultPath;

      if (!fs.existsSync(defaultPath)) {
        // If the default file doesn't exist, check for a hashed file to move back
        existingHashedPaths ??= _getExistingHashedChangelogs(cwd);
        if (existingHashedPaths[ext]) {
          moveIfNeeded({ oldPath: existingHashedPaths[ext]!, newPath: defaultPath, wasHashed: true });
        }
      }
    }
  }

  return paths;
}

/**
 * Get paths to existing `CHANGELOG-{hash}.md` and `CHANGELOG-{hash}.json` files.
 * Exported for testing only.
 */
export function _getExistingHashedChangelogs(cwd: string): ChangelogPaths {
  let hashedFiles: { file: string; hash: string; date?: number }[];
  try {
    hashedFiles = fs
      .readdirSync(cwd)
      .filter(file => /^CHANGELOG-[a-f\d]{8,}\.(json|md)$/.test(file))
      .map(file => ({ file, hash: file.match(/[a-f\d]{8,}/)![0] }));
  } catch (e) {
    console.warn(`Error listing files in ${cwd}: ${e}`);
    return {};
  }

  if (!hashedFiles.length) {
    return {};
  }

  const paths: ChangelogPaths = {};

  if (hashedFiles.every(({ hash }) => hash === hashedFiles[0].hash)) {
    // All the files have the same hash, so use that.
    paths.hash = hashedFiles[0].hash;
  } else {
    // Not likely, but just in case there are mismatched hashes, pick the newest one.
    try {
      for (const fileInfo of hashedFiles) {
        fileInfo.date = fs.statSync(path.join(cwd, fileInfo.file)).mtimeMs;
      }
      // sort by date descending
      hashedFiles.sort((a, b) => b.date! - a.date!);
      paths.hash = hashedFiles[0].hash;
      console.warn(
        `Found changelog files with multiple hashes in ${cwd} (using the newest one ${paths.hash}):\n` +
          hashedFiles.map(({ file }) => file).join('\n')
      );
    } catch (e) {
      console.warn(`Error getting changelog file dates in ${cwd}:`, e);
    }
  }

  if (paths.hash) {
    for (const ext of ['md', 'json'] as const) {
      // Only return hashed files that actually exist and match the chosen hash
      const extPath = hashedFiles.find(({ file }) => file.endsWith(`${paths.hash}.${ext}`))?.file;
      paths[ext] = extPath && path.join(cwd, extPath);
    }
  }

  return paths;
}

function moveIfNeeded(params: { oldPath: string; newPath: string; wasHashed: boolean }) {
  const { oldPath, newPath, wasHashed } = params;
  try {
    if (fs.existsSync(oldPath)) {
      fs.renameSync(oldPath, newPath);
      console.log(`Renamed existing ${wasHashed ? 'hashed' : 'non-hashed'} changelog file ${oldPath} to ${newPath}`);
    }
  } catch (e) {
    console.warn(`Error renaming changelog file ${oldPath} to ${newPath}: ${e}`);
  }
}
