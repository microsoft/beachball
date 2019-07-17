import { bump, BumpInfo } from './bump';
import { CliOptions } from './CliOptions';
import { git, revertLocalChanges, parseRemoteBranch, getBranchName } from './git';
import { packagePublish, listPackageVersions } from './packageManager';
import prompts from 'prompts';
import { generateTag } from './tag';

export async function publish(options: CliOptions) {
  const { path: cwd, branch, registry, tag, token, message, access } = options;

  const currentBranch = getBranchName(cwd);

  console.log(`Publishing with the following configuration:

  registry: ${registry}
  
  current branch: ${currentBranch}
  target branch: ${branch}
  tag: ${tag}

  publishes to npm registry: ${options.publish ? 'yes' : 'no'}
  pushes to remote git repo: ${options.push && options.branch ? 'yes' : 'no'}

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
        displayManualRecovery(bumpInfo);
        console.error(result.stderr);
        process.exit(1);
        return;
      }
    });
  } else {
    console.log('Skipping publish');
  }

  // Step 2.
  // - reset, fetch latest from origin/master (to ensure less chance of conflict), then bump again + commit
  if (!branch || !options.push) {
    console.log('Skipping git push and tagging');
  } else {
    const { remote, remoteBranch } = parseRemoteBranch(branch);
    console.log('Reverting and fetching from remote');

    // pull in latest from origin branch
    revertLocalChanges(cwd);
    git(['fetch', remote], { cwd });
    const mergeResult = git(['merge', '-X', 'theirs', `${branch}`], { cwd });
    if (!mergeResult.success) {
      console.error(`CRITICAL ERROR: pull from ${branch} has failed!`);
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

    console.log(`pushing to ${branch}, running the following command for git push:`);
    const pushArgs = ['push', '--follow-tags', '--no-verify', '--verbose', remote, `HEAD:${remoteBranch}`];
    console.log('git ' + pushArgs.join(' '));
    git(pushArgs);
  }
}

function displayManualRecovery(bumpInfo: BumpInfo) {
  console.error('Something went wrong with the publish! Manually update these package and versions:');

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
    git(['tag', generateTag(packageInfo.name, packageInfo.version)], { cwd });
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
