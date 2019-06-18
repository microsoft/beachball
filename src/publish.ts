import { bump, BumpInfo } from './bump';
import { CliOptions } from './CliOptions';
import { git, revertLocalChanges, getRemoteBranch, parseRemoteBranch, getBranchName, getFullBranchRef, getShortBranchName } from './git';
import { packagePublish, listPackageVersions } from './packageManager';
import prompts from 'prompts';

export async function publish(options: CliOptions) {
  const { path: cwd, branch, registry, tag, token, message, access } = options;

  const targetBranchRef = getFullBranchRef(branch, cwd);

  if (!targetBranchRef) {
    console.error(`Target branch does not exist: ${targetBranchRef}`);
    process.exit(1);

    // return here to appease the TS compiler errors, but we both know that process has already exited... shhh...
    return;
  }

  const remoteFullBranchName = getRemoteBranch(getShortBranchName(targetBranchRef, cwd)!, cwd);

  console.log(`Publishing from beachball

  registry: ${registry}
  current branch: ${getBranchName(cwd)}
  target branch: ${branch} (${targetBranchRef})
  remote tracked branch: ${remoteFullBranchName || '[not tracking a remote]'}
  tag: ${tag}
`);

  if (!options.yes) {
    const response = await prompts({
      type: 'confirm',
      name: 'yes',
      message: 'Is everything correct (use the --yes or -y arg to skip this prompt)?'
    });

    if (!response.yes) {
      return;
    }
  }

  // checkout publish branch
  const publishBranch = 'publish_' + String(new Date().getTime());
  git(['checkout', '-b', publishBranch]);

  // Step 1. Bump + npm publish
  // bump the version
  console.log('Bumping version for npm publish');
  const bumpInfo = bump(cwd);

  if (!validatePackageVersions(bumpInfo, registry)) {
    displayManualRecovery(bumpInfo);
    console.error('No packages have been published');
    process.exit(1);
  }

  // npm / yarn publish
  if (options.publish) {
    Object.keys(bumpInfo.packageChangeTypes).forEach(pkg => {
      const packageInfo = bumpInfo.packageInfos[pkg];
      console.log(`Publishing - ${packageInfo.name}@${packageInfo.version}`);
      const result = packagePublish(packageInfo, registry, token, tag, access);
      if (result.success) {
        console.log('Published!');
      } else {
        console.log('Error publishing');
        console.error(result.stderr);
        process.exit(1);
        return;
      }
    });
  }

  // Step 2.
  // - For repos with no remotes: just commit and move on!
  // - For repos with remotes: reset, fetch latest from origin/master (to ensure less chance of conflict), then bump again + commit
  if (!remoteFullBranchName || !options.push) {
    console.log('Committing changes locally.');
    const mergePublishBranchResult = mergePublishBranch(publishBranch, branch, message, cwd);

    if (!mergePublishBranchResult.success) {
      console.error('CRITICAL ERROR: merging to target has failed!');
      displayManualRecovery(bumpInfo);
      process.exit(1);
    }

    tagPackages(bumpInfo, tag, cwd);
  } else {
    const { remote, remoteBranch } = parseRemoteBranch(remoteFullBranchName);

    console.log('Reverting and fetching from remote');

    // pull in latest from origin branch
    revertLocalChanges(cwd);
    git(['fetch', remote], { cwd });
    const mergeResult = git(['merge', '-X', 'theirs', `${remoteFullBranchName}`], { cwd });
    if (!mergeResult.success) {
      console.error(`CRITICAL ERROR: pull from ${remoteFullBranchName} has failed!`);
      console.error(mergeResult.stderr);
      displayManualRecovery(bumpInfo);
      process.exit(1);
    }

    // bump the version
    console.log('Bumping the versions for git push');
    bump(cwd);

    // checkin
    const mergePublishBranchResult = mergePublishBranch(publishBranch, branch, message, cwd);

    if (!mergePublishBranchResult.success) {
      console.error('CRITICAL ERROR: merging to target has failed!');
      displayManualRecovery(bumpInfo);
      process.exit(1);
    }

    // Step 3. Tag & Push to remote
    tagPackages(bumpInfo, tag, cwd);

    console.log(`pushing to ${remoteFullBranchName}, running the following command for git push:`);
    const pushArgs = ['push', '--follow-tags', remote, `${targetBranchRef}:${remoteBranch}`];
    console.log('git ' + pushArgs.join(' '));
    git(pushArgs);
  }
}

function displayManualRecovery(bumpInfo: BumpInfo) {
  console.error('Manually update these package and versions:');

  Object.keys(bumpInfo.packageChangeTypes).forEach(pkg => {
    const packageInfo = bumpInfo.packageInfos[pkg];
    console.error(`- ${packageInfo.name}@${packageInfo.version}`);
  });
}

function mergePublishBranch(publishBranch: string, branch: string, message: string, cwd: string) {
  git(['add', '.'], { cwd });
  git(['commit', '-m', message], { cwd });
  git(['checkout', branch], { cwd });

  const mergePublishBranchResult = git(['merge', '-X', 'ours', publishBranch], { cwd });
  if (mergePublishBranchResult.success) {
    git(['branch', '-D', publishBranch]);
  }

  return mergePublishBranchResult;
}

function tagPackages(bumpInfo: BumpInfo, tag: string, cwd: string) {
  Object.keys(bumpInfo.packageChangeTypes).forEach(pkg => {
    const packageInfo = bumpInfo.packageInfos[pkg];
    console.log(`Tagging - ${packageInfo.name}@${packageInfo.version}`);
    git(['tag', `${packageInfo.name}_v${packageInfo.version}`], { cwd });
  });

  // Adds a special dist-tag based tag in git
  if (tag !== 'latest') {
    git(['tag', '-f', tag], { cwd });
  }
}

function validatePackageVersions(bumpInfo: BumpInfo, registry: string) {
  let hasErrors: boolean = false;

  Object.keys(bumpInfo.packageChangeTypes).forEach(pkg => {
    const packageInfo = bumpInfo.packageInfos[pkg];
    process.stdout.write(`Validating package version - ${packageInfo.name}@${packageInfo.version}`);

    const publishedVersions = listPackageVersions(packageInfo.name, registry);
    if (publishedVersions.includes(packageInfo.version)) {
      console.error(
        `\nERROR: Attempting to bump to a version that already exists in the registry: ${packageInfo.name}@${packageInfo.version}`
      );
      hasErrors = true;
    } else {
      process.stdout.write(' OK!\n');
    }
  });

  return !hasErrors;
}
