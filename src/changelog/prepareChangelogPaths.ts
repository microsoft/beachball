import fs from 'fs';
import path from 'path';
import { v4 as uuid } from 'uuid';
import type { BeachballOptions } from '../types/BeachballOptions';

interface ChangelogPaths {
  /** Absolute path to changelog md file (new or existing) */
  md?: string;
  /** Absolute path to changelog json file (new or existing) */
  json?: string;
  /** Suffix being used in files, if any */
  suffix?: string;
}

/**
 * Get the paths to the changelog files. Also handles conversion between `changelog.uniqueFilenames`
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
  const { uniqueFilenames } = changelog || {};

  const paths: ChangelogPaths = {};
  let existingSuffixedPaths: ChangelogPaths | undefined;

  if (!generateChangelog) {
    return paths;
  }

  for (const ext of ['md', 'json'] as const) {
    if (generateChangelog !== true && generateChangelog !== ext) {
      continue; // not generating this file type
    }

    const defaultPath = path.join(cwd, `CHANGELOG.${ext}`);

    if (uniqueFilenames) {
      // Filenames should use a suffix. Start by getting any existing suffixed changelogs...
      existingSuffixedPaths ??= _getExistingSuffixedChangelogs(cwd);
      // Use the existing suffix or generate a new one
      paths.suffix ??= existingSuffixedPaths.suffix ?? uuid().slice(0, 8);

      if (existingSuffixedPaths[ext]) {
        // Suffixed file already exists, so use it
        paths[ext] = existingSuffixedPaths[ext];
      } else {
        // New suffixed file
        paths[ext] = path.join(cwd, `CHANGELOG-${paths.suffix}.${ext}`);
        // Move any existing non-suffixed file to the new suffixed path
        moveIfNeeded({ oldPath: defaultPath, newPath: paths[ext]!, hadSuffix: false });
      }
    } else {
      // Filenames should not use a suffix
      paths[ext] = defaultPath;

      if (!fs.existsSync(defaultPath)) {
        // If the default file doesn't exist, check for a suffixed file to move back
        existingSuffixedPaths ??= _getExistingSuffixedChangelogs(cwd);
        if (existingSuffixedPaths[ext]) {
          moveIfNeeded({ oldPath: existingSuffixedPaths[ext]!, newPath: defaultPath, hadSuffix: true });
        }
      }
    }
  }

  return paths;
}

/**
 * Get paths to existing `CHANGELOG-{suffix}.md` and `CHANGELOG-{suffix}.json` files.
 * Exported for testing only.
 */
export function _getExistingSuffixedChangelogs(cwd: string): ChangelogPaths {
  let suffixedFiles: { file: string; suffix: string; date?: number }[];
  try {
    suffixedFiles = fs
      .readdirSync(cwd)
      .filter(file => /^CHANGELOG-[a-f\d]{8,}\.(json|md)$/.test(file))
      .map(file => ({ file, suffix: file.match(/[a-f\d]{8,}/)![0] }));
  } catch (e) {
    console.warn(`Error listing files in ${cwd}: ${e}`);
    return {};
  }

  if (!suffixedFiles.length) {
    return {};
  }

  const paths: ChangelogPaths = {};

  if (suffixedFiles.every(({ suffix }) => suffix === suffixedFiles[0].suffix)) {
    // All the files have the same suffix, so use that.
    paths.suffix = suffixedFiles[0].suffix;
  } else {
    // Not likely, but just in case there are mismatched suffixes, pick the newest one.
    try {
      for (const fileInfo of suffixedFiles) {
        fileInfo.date = fs.statSync(path.join(cwd, fileInfo.file)).mtimeMs;
      }
      // sort by date descending
      suffixedFiles.sort((a, b) => b.date! - a.date!);
      paths.suffix = suffixedFiles[0].suffix;
      console.warn(
        `Found changelog files with multiple suffixes in ${cwd} (using the newest one ${paths.suffix}):\n` +
          suffixedFiles.map(({ file }) => file).join('\n')
      );
    } catch (e) {
      console.warn(`Error getting changelog file dates in ${cwd}:`, e);
    }
  }

  if (paths.suffix) {
    for (const ext of ['md', 'json'] as const) {
      // Only return suffixed files that actually exist and match the chosen suffix
      const extPath = suffixedFiles.find(({ file }) => file.endsWith(`${paths.suffix}.${ext}`))?.file;
      paths[ext] = extPath && path.join(cwd, extPath);
    }
  }

  return paths;
}

function moveIfNeeded(params: { oldPath: string; newPath: string; hadSuffix: boolean }) {
  const { oldPath, newPath, hadSuffix } = params;
  try {
    if (fs.existsSync(oldPath)) {
      fs.renameSync(oldPath, newPath);
      console.log(
        `Renamed existing ${hadSuffix ? 'suffixed' : 'non-suffixed'} changelog file ${oldPath} to ${newPath}`
      );
    }
  } catch (e) {
    console.warn(`Error renaming changelog file ${oldPath} to ${newPath}: ${e}`);
  }
}
