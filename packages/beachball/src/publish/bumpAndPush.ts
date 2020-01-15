import { performBump } from '../bump/performBump';
import { BumpInfo } from '../types/BumpInfo';
import { BeachballOptions } from '../types/BeachballOptions';
import { git, gitFailFast, revertLocalChanges, parseRemoteBranch } from '../git';
import { tagPackages } from './tagPackages';
import { mergePublishBranch } from './mergePublishBranch';
import { displayManualRecovery } from './displayManualRecovery';
export function bumpAndPush(bumpInfo: BumpInfo, publishBranch: string, options: BeachballOptions) {
  const { path: cwd, branch, tag, message } = options;
  const { remote, remoteBranch } = parseRemoteBranch(branch);
  console.log('Reverting');
  revertLocalChanges(cwd);
  console.log('Fetching from remote');
  // pull in latest from origin branch
  gitFailFast(['fetch', remote], { cwd });
  const mergeResult = git(['merge', '-X', 'theirs', `${branch}`], { cwd });
  if (!mergeResult.success) {
    console.error(`CRITICAL ERROR: pull from ${branch} has failed!`);
    console.error(mergeResult.stderr);
    process.exit(1);
  }
  // bump the version
  console.log('Bumping the versions for git push');
  performBump(bumpInfo, options);
  // checkin
  const mergePublishBranchResult = mergePublishBranch(publishBranch, branch, message, cwd);
  if (!mergePublishBranchResult.success) {
    console.error('CRITICAL ERROR: merging to target has failed!');
    displayManualRecovery(bumpInfo);
    process.exit(1);
  }
  // Step 3. Tag & Push to remote
  tagPackages(bumpInfo, tag, cwd);
  console.log(`pushing to ${branch}, running the following command for git push:`);
  const pushArgs = ['push', '--no-verify', '--follow-tags', '--verbose', remote, `HEAD:${remoteBranch}`];
  console.log('git ' + pushArgs.join(' '));
  const pushResult = git(pushArgs, { cwd });
  if (!pushResult.success) {
    console.error(`CRITICAL ERROR: push to ${branch} has failed!`);
    console.error(pushResult.stderr);
    displayManualRecovery(bumpInfo);
    process.exit(1);
  } else {
    console.log(pushResult.stdout.toString());
    console.log(pushResult.stderr.toString());
  }
}
