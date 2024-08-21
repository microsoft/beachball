import { git, parseRemoteBranch } from 'workspace-tools';
import { BeachballOptions } from '../types/BeachballOptions';
import { gitFetch } from './fetch';

/**
 * Ensure that adequate history is available to check for changes between HEAD and `options.branch`.
 * Otherwise attempting to get changes will fail with an error "no merge base".
 * (This is mostly an issue with CI builds that use shallow clones.)
 *
 * Throws an error if history is inadequate and cannot be fixed.
 */
export function ensureSharedHistory(
  options: Pick<BeachballOptions, 'fetch' | 'path' | 'branch' | 'depth' | 'verbose'>
): void {
  const { fetch, path: cwd, branch, depth, verbose } = options;
  // `branch` should *usually* include a remote, but it's not guaranteed (see doc comment).
  // `remote` is the remote name (e.g. "origin") or "" if `branch` was missing a remote.
  // `remoteBranch` is the comparison branch name (e.g. "main").
  const { remote, remoteBranch } = parseRemoteBranch(branch);

  // Ensure the comparison branch ref exists
  if (!hasBranchRef(branch, cwd)) {
    if (!fetch) {
      // If fetching is disabled, the target branch must be available for comparison locally.
      // This is most likely to be an issue in a CI build which does a shallow checkout (github
      // actions/checkout does this by default) and also disables beachball fetching.
      logError('missing-branch', branch, remote, remoteBranch);
      throw new Error(`Target branch "${branch}" does not exist locally, and fetching is disabled`);
    }

    if (!remote) {
      // If the remote isn't specified, even if fetching is allowed it will be unclear what to
      // compare against
      throw new Error(
        `Target branch "${branch}" doesn't exist locally, and a remote name wasn't specified and couldn't be inferred. ` +
          'Please set "repository" in your root package.json or include a remote in the beachball "branch" setting.'
      );
    }

    // If fetching the requested branch isn't already (probably) configured, add it to the list so
    // it can be fetched in the next step. Otherwise the ref <remote>/<remoteBranch> won't exist locally.
    const fetchConfig = git(['config', '--get-all', `remote.${remote}.fetch`], { cwd }).stdout.trim();
    if (!fetchConfig.includes(`${remote}/*`) && !fetchConfig.includes(branch)) {
      console.log(`Adding branch "${remoteBranch}" to fetch config for remote "${remote}"`);
      const result = git(['remote', 'set-branches', '--add', remote, remoteBranch], { cwd });
      if (!result.success) {
        throw new Error(
          `Failed to add branch "${remoteBranch}" to fetch config for remote "${remote}":\n${result.stderr}`
        );
      }
    }
  }

  if (fetch) {
    // Fetch the latest from the remote branch for comparison. If the specified remoteBranch doesn't
    // exist (or there's a network error or something), this will return an error.
    const result = gitFetch({
      remote,
      branch: remoteBranch,
      cwd,
      verbose,
      // Only use "depth" if the repo is already shallow, since fetching a normal repo with --depth
      // will convert it to shallow (which is likely not desired and could be confusing)
      depth: depth && isShallowRepository(cwd) ? depth : undefined,
    });
    if (!result.success) {
      throw new Error(result.errorMessage);
    }
  }

  // Verify that HEAD and the target branch share history
  let isConnected = hasCommonCommit(branch, cwd);
  if (!isConnected) {
    // If this is a shallow repo, history may not go back far enough to connect the branches
    if (isShallowRepository(cwd)) {
      if (!fetch) {
        // Fetching is disabled, so the lack of history can't be fixed
        logError('shallow-clone', branch, remote, remoteBranch);
        throw new Error(`Inadequate history available to connect HEAD to target branch "${branch}"`);
      }

      // Try fetching more history
      isConnected = deepenHistory({ remote, remoteBranch, branch, depth, cwd, verbose });
    }

    if (!isConnected) {
      throw new Error(`HEAD does not appear to share history with target branch "${branch}"`);
    }
  }
}

/**
 * Try to deepen history of a shallow clone to find a common commit with the target branch.
 * Returns true if a common commit can be found after fetching more history.
 * Throws if there's any issue
 */
function deepenHistory(params: {
  remote: string;
  remoteBranch: string;
  branch: string;
  depth: number | undefined;
  cwd: string;
  verbose?: boolean;
}): boolean {
  const { remote, remoteBranch, branch, cwd, verbose } = params;
  const depth = params.depth || 100;

  console.log(`This is a shallow clone. Deepening to check for changes...`);

  // Iteratively deepen the history
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`Deepening by ${depth} more commits (attempt ${attempt}/${maxAttempts})...`);
    const result = gitFetch({ remote, branch: remoteBranch, deepen: depth, cwd, verbose });
    if (!result.success) {
      throw new Error(`Failed to fetch more history (see above for details)`);
    }
    if (hasCommonCommit(branch, cwd)) {
      // Fetched enough history to find a common commit
      return true;
    }
    if (!isShallowRepository(cwd)) {
      // Fetched all history and still no common commit
      return false;
    }
  }

  // No common commit was found and the repo is still shallow, so fully unshallow it
  console.log(`Still didn't find a common commit after deepening by ${depth * maxAttempts}. Unshallowing...`);
  const result = gitFetch({ remote, branch: remoteBranch, unshallow: true, cwd, verbose });
  if (!result.success) {
    throw new Error(`Failed to unshallow repo (see above for details)`);
  }

  return hasCommonCommit(branch, cwd);
}

function logError(
  error: 'missing-branch' | 'shallow-clone',
  branch: string,
  remote: string,
  remoteBranch: string
): void {
  let mainError: string;
  let mitigationSteps: string;

  switch (error) {
    case 'missing-branch':
      // Due to checks in the calling method, "remote" should be non-empty here
      mainError = `Target branch "${branch}" does not exist locally, and fetching is disabled.`;
      mitigationSteps = `- Fetch the branch manually:\n   git remote set-branches --add ${remote} ${remoteBranch} && git fetch ${remote}`;
      break;
    case 'shallow-clone':
      mainError =
        'This repo is a shallow clone, fetching is disabled, and not enough history is ' +
        `available to connect HEAD to "${branch}".`;
      mitigationSteps = [
        "- Verify that you're using the correct target branch",
        '- Unshallow or deepen the clone manually',
      ].join('\n');
      break;
  }

  console.error(`

${mainError}

Some possible fixes:
${mitigationSteps}
- Omit the "--no-fetch" / "--fetch=false" option from the command line
- Remove "fetch: false" from the beachball config
- If this is a CI build, ensure that adequate history is being fetched
  - For GitHub Actions (actions/checkout), add the option "fetch-depth: 0" in the checkout step

`);
}

function hasBranchRef(branch: string, cwd: string): boolean {
  return git(['rev-parse', '--verify', branch], { cwd }).success;
}

function isShallowRepository(cwd: string): boolean {
  return git(['rev-parse', '--is-shallow-repository'], { cwd }).stdout.trim() === 'true';
}

/** Returns whether `branch` and HEAD have a common commit anywhere in their history */
function hasCommonCommit(branch: string, cwd: string): boolean {
  return git(['merge-base', branch, 'HEAD'], { cwd }).success;
}
