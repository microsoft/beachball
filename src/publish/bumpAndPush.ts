import { performBump } from '../bump/performBump';
import { BumpInfo } from '../types/BumpInfo';
import { BeachballOptions } from '../types/BeachballOptions';
import { git, gitFailFast, revertLocalChanges, parseRemoteBranch } from '../git';
import { tagDistTag, tagPackages } from './tagPackages';
import { mergePublishBranch } from './mergePublishBranch';
import { displayManualRecovery } from './displayManualRecovery';

const BUMP_PUSH_RETRIES = 5;

export async function bumpAndPush(bumpInfo: BumpInfo, publishBranch: string, options: BeachballOptions) {
  const { path: cwd, branch, tag, message } = options;
  const { remote, remoteBranch } = parseRemoteBranch(branch);

  let completed = false;
  let tryNumber = 0;

  while (tryNumber < BUMP_PUSH_RETRIES && !completed) {
    tryNumber++;
    console.log(`Trying to push to git. Attempt ${tryNumber}/${BUMP_PUSH_RETRIES}`);
    console.log('Reverting');
    revertLocalChanges(cwd);

    // pull in latest from origin branch
    console.log('Fetching from remote');
    gitFailFast(['fetch', remote], { cwd });
    const mergeResult = git(['merge', '-X', 'theirs', `${branch}`], { cwd });
    if (!mergeResult.success) {
      console.warn(`[WARN ${tryNumber}/${BUMP_PUSH_RETRIES}]: pull from ${branch} has failed!\n${mergeResult.stderr}`);
      continue;
    }

    // bump the version
    console.log('Bumping the versions for git push');
    await performBump(bumpInfo, options);

    // checkin
    const mergePublishBranchResult = mergePublishBranch(publishBranch, branch, message, cwd);
    if (!mergePublishBranchResult.success) {
      console.warn(`[WARN ${tryNumber}/${BUMP_PUSH_RETRIES}]: merging to target has failed!`);
      continue;
    }

    // Tag & Push to remote
    tagPackages(bumpInfo, cwd);
    if (options.gitTags) {
      tagDistTag(tag, cwd);
    }

    console.log(`pushing to ${branch}, running the following command for git push:`);
    const pushArgs = ['push', '--no-verify', '--follow-tags', '--verbose', remote, `HEAD:${remoteBranch}`];
    console.log('git ' + pushArgs.join(' '));

    const pushResult = git(pushArgs, { cwd });

    if (!pushResult.success) {
      console.warn(`[WARN ${tryNumber}/${BUMP_PUSH_RETRIES}]: push to ${branch} has failed!\n${pushResult.stderr}`);
      continue;
    } else {
      console.log(pushResult.stdout.toString());
      console.log(pushResult.stderr.toString());
      completed = true;
    }
  }

  if (!completed) {
    displayManualRecovery(bumpInfo);
    process.exit(1);
  }
}
