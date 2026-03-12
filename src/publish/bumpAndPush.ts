import { performBump } from '../bump/performBump';
import type { BumpInfo } from '../types/BumpInfo';
import type { BeachballOptions } from '../types/BeachballOptions';
import { revertLocalChanges, parseRemoteBranch } from 'workspace-tools';
import { tagPackages } from './tagPackages';
import { displayManualRecovery } from './displayManualRecovery';
import { gitFetch } from '../git/fetch';
import { gitAsync } from '../git/gitAsync';
import { BeachballError } from '../types/BeachballError';
import { logger } from '../logging/logger';

const bumpPushRetries = 5;
/** Use verbose logging for these steps to make it easier to debug if something goes wrong */
const verbose = true;

/**
 * Bump versions locally, commit, optionally tag, and push to git.
 *
 * This should NOT mutate `bumpInfo`.
 */
export async function bumpAndPush(
  bumpInfo: Readonly<BumpInfo>,
  publishBranch: string,
  options: BeachballOptions
): Promise<void> {
  const { path: cwd, branch, depth, gitTimeout } = options;
  const { remote, remoteBranch } = parseRemoteBranch({ branch, cwd });

  let completed = false;
  let tryNumber = 0;

  /** Log a warning which includes the attempt number */
  const logRetryWarning = (text: string, details = '(see above for details)') =>
    logger.warn(`[WARN ${tryNumber}/${bumpPushRetries}]: ${text} ${details}`);

  while (tryNumber < bumpPushRetries && !completed) {
    tryNumber++;
    logger.log('-'.repeat(80));
    logger.log(`Bumping versions and pushing to git (attempt ${tryNumber}/${bumpPushRetries})`);
    logger.log('Reverting');
    revertLocalChanges({ cwd });

    // pull in latest from origin branch
    if (options.fetch !== false) {
      logger.log();
      const fetchResult = gitFetch({ remote, branch: remoteBranch, depth, cwd, verbose });
      if (!fetchResult.success) {
        logRetryWarning(`Fetching from ${branch} has failed!`);
        continue;
      }
    }

    logger.log(`\nMerging with ${branch}...`);
    const mergeResult = await gitAsync(['merge', '-X', 'theirs', branch], { cwd, verbose });
    if (!mergeResult.success) {
      logRetryWarning(`Merging with latest ${branch} has failed!`);
      continue;
    }

    // bump the version
    logger.log('\nBumping versions locally (and writing changelogs if requested)');
    await performBump(bumpInfo, options);

    // checkin
    if (!(await mergePublishBranch(publishBranch, options))) {
      logRetryWarning('Merging to target has failed!');
      continue;
    }

    // create git tags
    logger.log('\nCreating git tags for new versions...');
    tagPackages(bumpInfo, options);

    // push
    logger.log(`\nPushing to ${branch}...`);

    const pushResult = await gitAsync(
      ['push', '--no-verify', '--follow-tags', '--verbose', remote, `HEAD:${remoteBranch}`],
      { cwd, verbose, timeout: gitTimeout }
    );
    if (pushResult.success) {
      completed = true;
    } else if (pushResult.timedOut) {
      logRetryWarning(`Pushing to ${branch} has timed out!`);
    } else {
      logRetryWarning(`Pushing to ${branch} has failed!`);
    }
  }

  if (!completed) {
    displayManualRecovery(bumpInfo);
    throw new BeachballError(`Failed to bump and push after ${bumpPushRetries} attempts`, {
      alreadyLogged: true,
    });
  }
}

async function mergePublishBranch(
  publishBranch: string,
  options: Pick<BeachballOptions, 'branch' | 'hooks' | 'message' | 'path'>
): Promise<boolean> {
  await options.hooks?.precommit?.(options.path);

  logger.log(`\nMerging ${publishBranch} into ${options.branch}...`);
  const mergeSteps = [
    ['add', '.'],
    ['commit', '-m', options.message],
    ['checkout', options.branch],
    ['merge', '-X', 'ours', publishBranch],
  ];
  for (const step of mergeSteps) {
    const result = await gitAsync(step, { cwd: options.path, verbose });
    if (!result.success) {
      return false;
    }
  }
  return true;
}
