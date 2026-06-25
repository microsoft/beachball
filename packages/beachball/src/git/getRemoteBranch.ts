import { parseRemoteBranch } from 'workspace-tools';
import { BeachballError } from '../types/BeachballError';
import type { BeachballOptions } from '../types/BeachballOptions';

export type RemoteBranch = {
  /** Remote name (always set) */
  remote: string;
  /** Branch name without the remote prefix */
  remoteBranch: string;
};

const cache: Record<`${string}#${string}`, RemoteBranch> = {};

/**
 * Get the remote name and branch name (no prefix) from `branch`, with caching.
 *
 * Throws if the remote could not be determined (should never happen after initial option processing,
 * which ensures the branch includes a remote name).
 */
export function getRemoteBranch(options: Pick<BeachballOptions, 'branch' | 'path'>): RemoteBranch {
  const { branch, path: cwd } = options;

  const cacheKey = getCacheKey({ cwd, branch });
  if (cache[cacheKey]) {
    return cache[cacheKey];
  }

  // If `branch` starts with "origin" or "upstream", that's assumed to be the remote, but otherwise
  // it will get the actual list of remotes from git config.
  const parsed = parseRemoteBranch({ branch, cwd });
  if (!parsed.remote) {
    throw new BeachballError(`Could not determine the remote for "${branch}"`);
  }
  const result = { remote: parsed.remote, remoteBranch: parsed.remoteBranch };
  cache[cacheKey] = result;
  return result;
}

/**
 * Add remote branch info to the cache for both `${remote}/${remoteBranch}` and `${remoteBranch}` keys.
 */
export function cacheRemoteBranch(info: RemoteBranch, cwd: string): void {
  cache[getCacheKey({ cwd, branch: `${info.remote}/${info.remoteBranch}` })] = info;
  cache[getCacheKey({ cwd, branch: info.remoteBranch })] = info;
}

function getCacheKey(params: { cwd: string; branch: string }): `${string}#${string}` {
  return `${params.cwd}#${params.branch}` as const;
}
