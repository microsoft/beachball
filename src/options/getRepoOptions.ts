import { cosmiconfigSync } from 'cosmiconfig';
import { findGitRoot, getDefaultRemoteBranch } from 'workspace-tools';
import { env } from '../env';
import type { RepoOptions, CliOptions, BeachballOptions } from '../types/BeachballOptions';
import path from 'path';

const cachedRepoOptions = new Map<CliOptions, Partial<RepoOptions>>();

export function getRepoOptions(cliOptions: CliOptions): Partial<RepoOptions> {
  const { configPath, path: cwd, branch } = cliOptions;
  if (!env.beachballDisableCache && cachedRepoOptions.has(cliOptions)) {
    return cachedRepoOptions.get(cliOptions)!;
  }

  let repoOptions: Partial<RepoOptions> | null | undefined;

  let rootDir: string;
  try {
    rootDir = findGitRoot(cwd);
  } catch {
    rootDir = path.parse(cwd).root;
  }
  const configExplorer = cosmiconfigSync('beachball', {
    cache: false,
    // cosmiconfig v9 doesn't search up by default. To preserve most of the old behavior plus
    // some of the efficiency gains, search up to the git root (if available, since realistically
    // this is the farthest up that a config file is likely to be) or fall back to searching up
    // to the filesystem root (probably the old behavior).
    stopDir: rootDir,
    searchStrategy: 'global',
  });

  if (configPath) {
    repoOptions = configExplorer.load(configPath)?.config as Partial<RepoOptions> | undefined;
    if (!repoOptions) {
      console.error(`Config file "${configPath}" could not be loaded`);
      process.exit(1);
    }
  } else {
    repoOptions = (configExplorer.search()?.config as Partial<RepoOptions> | undefined) || {};
  }

  // Only if the branch isn't specified in cliOptions (which takes precedence), fix it up or add it
  // in repoOptions. (We don't want to do the getDefaultRemoteBranch() lookup unconditionally to
  // avoid potential for log messages/errors which aren't relevant if the branch was specified on
  // the command line.)
  if (!branch) {
    const verbose = (repoOptions as BeachballOptions).verbose;
    if (repoOptions.branch && !repoOptions.branch.includes('/')) {
      // Add a remote to the branch if it's not already included
      repoOptions.branch = getDefaultRemoteBranch({ branch: repoOptions.branch, cwd, verbose });
    } else if (!repoOptions.branch) {
      // Branch is not specified at all. Add in the default remote and branch.
      repoOptions.branch = getDefaultRemoteBranch({ cwd, verbose });
    }
  }

  cachedRepoOptions.set(cliOptions, repoOptions);

  return repoOptions;
}
