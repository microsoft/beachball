import { bump, BumpInfo } from './bump';
import { CliOptions } from './CliOptions';
import { git, revertLocalChanges } from './git';
import { packagePublish, listPackageVersions } from './packageManager';

export function publish(options: CliOptions) {
  const { path: cwd, branch, registry, tag, token, message } = options;

  // checkout publish branch
  const publishBranch = 'publish_' + String(new Date().getTime());
  git(['checkout', '-b', publishBranch]);

  console.log(`Publishing from beachball

  registry: ${registry}
  target branch: ${branch}
  tag: ${tag}
`);

  // Step 1. Bump + npm publish
  // bump the version
  console.log('Bumping version for npm publish');
  const bumpInfo = bump(registry, cwd);

  if (!validatePackageVersions(bumpInfo, registry)) {
    displayManualRecovery(bumpInfo);
    console.error('No packages have been published');
    process.exit(1);
  }

  // npm / yarn publish
  Object.keys(bumpInfo.packageChangeTypes).forEach(pkg => {
    const packageInfo = bumpInfo.packageInfos[pkg];
    console.log(`Publishing - ${packageInfo.name}@${packageInfo.version}`);
    packagePublish(packageInfo, registry, token, tag);
  });

  // Step 2.
  // - For repos with no remotes: just commit and move on!
  // - For repos with remotes: reset, fetch latest from origin/master (to ensure less chance of conflict), then bump again + commit
  const remoteResult = git(['remote', 'get-url', 'origin']);

  if (!remoteResult.success) {
    console.log('Remote "origin" not found. Committing changes locally.');
    const mergePublishBranchResult = mergePublishBranch(publishBranch, branch, message, cwd);

    if (!mergePublishBranchResult.success) {
      console.error('CRITICAL ERROR: merging to target has failed!');
      displayManualRecovery(bumpInfo);
      process.exit(1);
    }

    tagPackages(bumpInfo, tag, cwd);
  } else {
    const remote = 'origin';

    console.log('Reverting and fetching from remote');

    // pull in latest from origin branch
    revertLocalChanges(cwd);
    git(['fetch', remote], { cwd });
    const mergeResult = git(['merge', '-X', 'theirs', `${remote}/${branch}`], { cwd });
    if (!mergeResult.success) {
      console.error('CRITICAL ERROR: pull from master has failed!');
      console.error(mergeResult.stderr);
      displayManualRecovery(bumpInfo);
      process.exit(1);
    }

    // bump the version
    console.log('Bumping the versions for git push');
    bump(registry, cwd);

    // checkin
    const mergePublishBranchResult = mergePublishBranch(publishBranch, branch, message, cwd);

    if (!mergePublishBranchResult.success) {
      console.error('CRITICAL ERROR: merging to target has failed!');
      displayManualRecovery(bumpInfo);
      process.exit(1);
    }

    // Step 3. Tag & Push to remote
    tagPackages(bumpInfo, tag, cwd);

    console.log(`pushing to ${remote}/${branch}`);
    git(['push', '--follow-tags', remote, branch]);
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
