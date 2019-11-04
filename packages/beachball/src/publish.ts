import { bump, BumpInfo, performBump, gatherBumpInfo } from './bump';
import { CliOptions } from './CliOptions';
import { git, gitFailFast, revertLocalChanges, parseRemoteBranch, getBranchName } from './git';
import { packagePublish, listPackageVersions } from './packageManager';
import prompts from 'prompts';
import { generateTag } from './tag';
import { getPackageChangeTypes, readChangeFiles } from './changefile';

export function publishToRegistry(bumpInfo: BumpInfo, options: CliOptions) {
  const { path: cwd, registry, tag, token, access } = options;

  performBump(bumpInfo, cwd);

  if (!validatePackageVersions(bumpInfo, registry)) {
    displayManualRecovery(bumpInfo);
    console.error('No packages have been published');
    process.exit(1);
  }

  Object.keys(bumpInfo.packageChangeTypes).forEach(pkg => {
    const packageInfo = bumpInfo.packageInfos[pkg];
    const changeType = bumpInfo.packageChangeTypes[pkg];

    if (changeType === 'none') {
      return;
    }

    if (!packageInfo.private) {
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
    } else {
      console.warn(
        `Skipping publish of ${packageInfo.name} since it is marked private. Version has been bumped to ${packageInfo.version}`
      );
    }
  });

  return;
}

export function bumpAndPush(bumpInfo: BumpInfo, publishBranch: string, options: CliOptions) {
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
  performBump(bumpInfo, cwd);

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

export async function publish(options: CliOptions) {
  const { path: cwd, branch, registry, tag, message } = options;

  // First, validate that we have changes to publish
  const changes = readChangeFiles(cwd);
  const packageChangeTypes = getPackageChangeTypes(changes);
  if (Object.keys(packageChangeTypes).length === 0) {
    console.log('Nothing to bump, skipping publish!');
    return;
  }

  // Collate the changes per package
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
      message: 'Is everything correct (use the --yes or -y arg to skip this prompt)?',
    });

    if (!response.yes) {
      return;
    }
  }

  // checkout publish branch
  const publishBranch = 'publish_' + String(new Date().getTime());
  gitFailFast(['checkout', '-b', publishBranch], { cwd });

  console.log('Bumping version for npm publish');
  const bumpInfo = gatherBumpInfo(cwd);

  // Step 1. Bump + npm publish
  // npm / yarn publish
  if (options.publish) {
    publishToRegistry(bumpInfo, options);
  } else {
    console.log('Skipping publish');
  }

  // Step 2.
  // - reset, fetch latest from origin/master (to ensure less chance of conflict), then bump again + commit
  if (branch && options.push) {
    bumpAndPush(bumpInfo, publishBranch, options);
  } else {
    console.log('Skipping git push and tagging');
  }

  if (currentBranch) {
    console.log(`git checkout ${currentBranch}`);
    gitFailFast(['checkout', currentBranch], { cwd });
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
  let result: ReturnType<typeof git>;

  let mergeSteps = [
    ['add', '.'],
    ['commit', '-m', message],
    ['checkout', branch],
    ['merge', '-X', 'ours', publishBranch],
    ['branch', '-D', publishBranch],
  ];

  for (let index = 0; index < mergeSteps.length; index++) {
    const step = mergeSteps[index];
    result = git(step, { cwd });
    if (!result.success) {
      console.error(`mergePublishBranch (${index + 1} / ${mergeSteps.length}) - trying to run "git ${step.join(' ')}"`);
      console.error(result.stdout && result.stdout.toString().trim());
      console.error(result.stderr && result.stderr.toString().trim());
      return result;
    }
  }

  return result!;
}

function createTag(tag: string, cwd: string) {
  gitFailFast(['tag', '-a', '-f', tag, '-m', tag], { cwd });
}

function tagPackages(bumpInfo: BumpInfo, tag: string, cwd: string) {
  Object.keys(bumpInfo.packageChangeTypes).forEach(pkg => {
    const packageInfo = bumpInfo.packageInfos[pkg];
    const changeType = bumpInfo.packageChangeTypes[pkg];

    // Do not tag change type of "none" or private packages
    if (changeType === 'none' || packageInfo.private) {
      return;
    }

    console.log(`Tagging - ${packageInfo.name}@${packageInfo.version}`);
    const generatedTag = generateTag(packageInfo.name, packageInfo.version);
    createTag(generatedTag, cwd);
  });

  // Adds a special dist-tag based tag in git
  if (tag && tag !== 'latest') {
    createTag(tag, cwd);
  }
}

function validatePackageVersions(bumpInfo: BumpInfo, registry: string) {
  let hasErrors: boolean = false;

  Object.keys(bumpInfo.packageChangeTypes).forEach(pkg => {
    const packageInfo = bumpInfo.packageInfos[pkg];
    const changeType = bumpInfo.packageChangeTypes[pkg];

    // Ignore private packages or change type "none" packages
    if (changeType === 'none' || packageInfo.private) {
      return;
    }

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
