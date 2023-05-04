import { gatherBumpInfo } from '../bump/gatherBumpInfo';
import { BeachballOptions } from '../types/BeachballOptions';
import { gitFailFast, getBranchName, getCurrentHash, git } from 'workspace-tools';
import prompts from 'prompts';
import { initializePackageChangeInfo } from '../changefile/getPackageChangeTypes';
import { readChangeFiles } from '../changefile/readChangeFiles';
import { bumpAndPush } from '../publish/bumpAndPush';
import { publishToRegistry } from '../publish/publishToRegistry';
import { getNewPackages } from '../publish/getNewPackages';
import { getPackageInfos } from '../monorepo/getPackageInfos';

export async function publish(options: BeachballOptions) {
  const { path: cwd, branch, registry, tag } = options;
  // First, validate that we have changes to publish
  const oldPackageInfos = getPackageInfos(cwd);
  const changes = readChangeFiles(options, oldPackageInfos);
  const packageChangeTypes = initializePackageChangeInfo(changes);
  if (Object.keys(packageChangeTypes).length === 0) {
    console.log('Nothing to bump, skipping publish!');
    return;
  }
  // Collate the changes per package
  const currentBranch = getBranchName(cwd);
  const currentHash = getCurrentHash(cwd);
  console.log(`Publishing with the following configuration:

  registry: ${registry}

  current branch: ${currentBranch}
  current hash: ${currentHash}
  target branch: ${branch}
  tag: ${tag}

  bumps versions: ${options.bump ? 'yes' : 'no'}
  publishes to npm registry: ${options.publish ? 'yes' : 'no'}
  pushes to remote git repo: ${options.bump && options.push && options.branch ? 'yes' : 'no'}

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

  console.log(`creating temporary publish branch ${publishBranch}`);
  gitFailFast(['checkout', '-b', publishBranch], { cwd });

  if (options.bump) {
    console.log('Bumping version for npm publish');
  }

  const bumpInfo = gatherBumpInfo(options, oldPackageInfos);

  if (options.new) {
    bumpInfo.newPackages = new Set<string>(await getNewPackages(bumpInfo, options));
  }

  // Step 1. Bump + npm publish
  // npm / yarn publish
  if (options.publish) {
    await publishToRegistry(bumpInfo, options);
  } else {
    console.log('Skipping publish');
  }

  // Step 2.
  // - reset, fetch latest from origin/master (to ensure less chance of conflict), then bump again + commit
  if (options.bump && branch && options.push) {
    await bumpAndPush(bumpInfo, publishBranch, options);
  } else {
    console.log('Skipping git push and tagging');
  }

  // Step 3.
  // Clean up: switch back to current branch, delete publish branch

  const revParseSuccessful = currentBranch || currentHash;
  if (currentBranch && currentBranch !== 'HEAD') {
    console.log(`git checkout ${currentBranch}`);
    gitFailFast(['checkout', currentBranch!], { cwd });
  } else if (currentHash) {
    console.log(`Looks like the repo was detached from a branch`);
    console.log(`git checkout ${currentHash}`);
    gitFailFast(['checkout', currentHash], { cwd });
  }

  if (revParseSuccessful) {
    console.log(`deleting temporary publish branch ${publishBranch}`);
    const deletionResult = git(['branch', '-D', publishBranch], { cwd });
    if (!deletionResult.success) {
      console.warn(`[WARN]: deletion of publish branch ${publishBranch} has failed!\n${deletionResult.stderr}`);
    }
  }
}
