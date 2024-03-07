import { gatherBumpInfo } from '../bump/gatherBumpInfo';
import { BeachballOptions } from '../types/BeachballOptions';
import { gitFailFast, getBranchName, getCurrentHash, git } from 'workspace-tools';
import prompts from 'prompts';
import { readChangeFiles } from '../changefile/readChangeFiles';
import { bumpAndPush } from '../publish/bumpAndPush';
import { publishToRegistry } from '../publish/publishToRegistry';
import { getNewPackages } from '../publish/getNewPackages';
import { getPackageInfos } from '../monorepo/getPackageInfos';

export async function publish(options: BeachballOptions): Promise<void> {
  console.log('\nPreparing to publish');

  const { path: cwd, branch, registry, tag } = options;
  // First, validate that we have changes to publish
  const oldPackageInfos = getPackageInfos(cwd);
  const changes = readChangeFiles(options, oldPackageInfos);

  if (!changes.length) {
    console.log('Nothing to bump, skipping publish!');
    return;
  }
  // Collate the changes per package
  const startingBranch = getBranchName(cwd);
  const startingHash = getCurrentHash(cwd);

  console.log(`\nPublishing ${options.dryRun ? 'dry run ' : ''}with the following configuration:

  registry: ${registry}

  current branch: ${startingBranch}
  current hash: ${startingHash}
  target branch: ${branch}
  tag: ${tag}

  bumps versions: ${options.bump ? 'yes' : 'no'}
  publishes to npm registry: ${options.dryRun ? 'dry run' : options.publish ? 'yes' : 'no'}
  pushes to remote git repo: ${
    options.bump && options.push && options.branch
      ? options.dryRun
        ? "commits changes but doesn't push"
        : 'yes'
      : 'no'
  }

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

  console.log(`Creating temporary publish branch ${publishBranch}`);
  gitFailFast(['checkout', '-b', publishBranch], { cwd });

  console.log(`\nGathering info ${options.bump ? 'to bump versions' : 'about versions and changes'}`);
  const bumpInfo = gatherBumpInfo(options, oldPackageInfos);
  if (options.new) {
    // Publish newly created packages even if they don't have change files
    // (this is unlikely unless the packages were pushed without a PR that runs "beachball check")
    bumpInfo.newPackages = new Set<string>(await getNewPackages(bumpInfo, options));
  }

  // Step 1. Bump + npm publish
  // npm / yarn publish
  if (options.publish) {
    console.log('\nBumping versions and publishing to npm');
    await publishToRegistry(bumpInfo, options);
    console.log();
  } else {
    console.log('Skipping publish');
  }

  // Step 2.
  // - reset, fetch latest from origin/master (to ensure less chance of conflict), then bump again + commit
  if (options.bump && branch && options.push) {
    // this does its own section logging
    await bumpAndPush(bumpInfo, publishBranch, options);
  } else {
    console.log('Skipping git push and tagging');
  }

  if (options.dryRun) {
    console.log('\nDry run complete (skipping cleanup so you can inspect the results)\n');
    return;
  }

  // Step 3.
  // Clean up: switch back to current branch, delete publish branch
  console.log('\nCleaning up');

  if (startingBranch && startingBranch !== 'HEAD') {
    console.log(`git checkout ${startingBranch}`);
    gitFailFast(['checkout', startingBranch], { cwd });
  } else if (startingHash) {
    console.log(`Looks like the repo was detached from a branch`);
    console.log(`git checkout ${startingHash}`);
    gitFailFast(['checkout', startingHash], { cwd });
  }

  if (startingBranch || startingHash) {
    console.log(`deleting temporary publish branch ${publishBranch}`);
    const deletionResult = git(['branch', '-D', publishBranch], { cwd });
    if (!deletionResult.success) {
      console.warn(`[WARN]: deletion of publish branch ${publishBranch} has failed!\n${deletionResult.stderr}`);
    }
  }
}
