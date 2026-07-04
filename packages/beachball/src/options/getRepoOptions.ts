import { cosmiconfigSync } from 'cosmiconfig';
import path from 'path';
import { findGitRoot } from 'workspace-tools';
import { BeachballError } from '../types/BeachballError';
import type { ParsedOptions, RepoOptions } from '../types/BeachballOptions';
import { resolveBranchOption } from './cliOptionsHelpers';

/**
 * Find the beachball config file and return the repo options.
 *
 * If `cliOptions.path` is empty, it's assumed to be running in a test without a filesystem
 * and returns an empty object.
 */
export function getRepoOptions(cliOptions: ParsedOptions['cliOptions']): Partial<RepoOptions> {
  const { configPath, path: cwd } = cliOptions;

  if (!cwd) {
    // If cwd is empty, it's probably running in a test without a filesystem.
    return {};
  }

  let repoOptions: Partial<RepoOptions> | null | undefined;

  let rootDir: string;
  try {
    rootDir = findGitRoot(cwd);
  } catch {
    rootDir = cwd;
  }
  const configExplorer = cosmiconfigSync('beachball', {
    cache: false,
    // cosmiconfig v9 doesn't search up by default. For a mix of preserving old behavior and
    // improving efficiency, only search up to the git root (if available) or cwd.
    stopDir: rootDir,
    searchStrategy: 'global',
  });

  if (configPath) {
    repoOptions = configExplorer.load(path.resolve(cwd, configPath))?.config as Partial<RepoOptions> | undefined;
    if (!repoOptions) {
      throw new BeachballError(`Config file "${configPath}" could not be loaded`);
    }
  } else {
    repoOptions = (configExplorer.search(cwd)?.config as Partial<RepoOptions> | undefined) || {};
  }

  // Only if the branch isn't specified in cliOptions (which takes precedence), fix it up or add it
  // in repoOptions
  if (!cliOptions.branch) {
    repoOptions.branch = resolveBranchOption(repoOptions, cwd);
  }

  return repoOptions;
}
