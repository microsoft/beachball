import { performBump } from '../bump/performBump';
import { BumpInfo } from '../types/BumpInfo';
import { BeachballOptions } from '../types/BeachballOptions';
import { git, revertLocalChanges, parseRemoteBranch } from 'workspace-tools';
import { tagPackages } from './tagPackages';
import { mergePublishBranch } from './mergePublishBranch';
import { displayManualRecovery } from './displayManualRecovery';

const BUMP_PUSH_RETRIES = 5;

export async function bumpAndPush(bumpInfo: BumpInfo, publishBranch: string, options: BeachballOptions) {
  const { path: cwd, branch, depth, message, gitTimeout } = options;
  const { remote, remoteBranch } = parseRemoteBranch(branch);

  let completed = false;
  let tryNumber = 0;

  while (tryNumber < BUMP_PUSH_RETRIES && !completed) {
    tryNumber++;
    console.log(`Trying to push to git. Attempt ${tryNumber}/${BUMP_PUSH_RETRIES}`);
    console.log('Reverting');
    revertLocalChanges(cwd);
    const warnPrefix = `[WARN ${tryNumber}/${BUMP_PUSH_RETRIES}]:`;

    // pull in latest from origin branch
    if (options.fetch !== false) {
      console.log('Fetching from remote');
      const fetchResult = git(['fetch', remote, remoteBranch, ...(depth ? [`--depth=${depth}`] : [])], { cwd });
      if (!fetchResult.success) {
        console.warn(`${warnPrefix} fetch from ${branch} has failed!\n${fetchResult.stderr}`);
        continue;
      }
    }

    const mergeResult = git(['merge', '-X', 'theirs', `${branch}`], { cwd });
    if (!mergeResult.success) {
      console.warn(`${warnPrefix} pull from ${branch} has failed!\n${mergeResult.stderr}`);
      continue;
    }

    // bump the version
    console.log('Bumping the versions for git push');
    await performBump(bumpInfo, options);

    // checkin
    const mergePublishBranchResult = await mergePublishBranch(publishBranch, branch, message, cwd, options);
    if (!mergePublishBranchResult.success) {
      console.warn(`${warnPrefix} merging to target has failed!`);
      continue;
    }

    // Tag & Push to remote
    tagPackages(bumpInfo, options);

    console.log(`pushing to ${branch}, running the following command for git push:`);
    const pushArgs = ['push', '--no-verify', '--follow-tags', '--verbose', remote, `HEAD:${remoteBranch}`];
    console.log('git ' + pushArgs.join(' '));

    try {
      const pushResult = git(pushArgs, { cwd, timeout: gitTimeout });

      if (!pushResult.success) {
        // If it timed out, the return value contains an "error" object with ETIMEDOUT code
        // (it doesn't throw the error)
        if ((pushResult.error as any)?.code === 'ETIMEDOUT') {
          console.warn(`${warnPrefix} push to ${branch} has timed out!`);
        } else {
          console.warn(`${warnPrefix} push to ${branch} has failed!\n${pushResult.stderr}`);
        }
      } else {
        console.log(pushResult.stdout.toString());
        console.log(pushResult.stderr.toString());
        completed = true;
      }
    } catch (e) {
      // This is likely not reachable (see comment above), but leaving it just in case for this critical operation
      console.warn(`${warnPrefix} push to ${branch} has failed!\n${e}`);
    }
  }

  if (!completed) {
    displayManualRecovery(bumpInfo);
    process.exit(1);
  }
}
