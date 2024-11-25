import { gatherBumpInfo } from '../bump/gatherBumpInfo';
import type { BeachballOptions } from '../types/BeachballOptions';
import { gitFailFast, getBranchName, getCurrentHash, git } from 'workspace-tools';
import prompts from 'prompts';
import { readChangeFiles } from '../changefile/readChangeFiles';
import { bumpAndPush } from '../publish/bumpAndPush';
import { publishToRegistry } from '../publish/publishToRegistry';
import { getNewPackages } from '../publish/getNewPackages';
import { getPackageInfos } from '../monorepo/getPackageInfos';
import type { PublishBumpInfo } from '../types/BumpInfo';

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
  const currentBranch = getBranchName(cwd);
  const currentHash = getCurrentHash(cwd);

  console.log(`\nPublishing with the following configuration:

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

  console.log(`Creating temporary publish branch ${publishBranch}`);
  gitFailFast(['checkout', '-b', publishBranch], { cwd });

  console.log(`\nGathering info ${options.bump ? 'to bump versions' : 'about versions and changes'}`);
  const bumpInfo: PublishBumpInfo = gatherBumpInfo(options, oldPackageInfos);

  if (options.new) {
    // Publish newly created packages even if they don't have change files
    // (this is unlikely unless the packages were pushed without a PR that runs "beachball check")
    console.log(
      '\nFetching all unmodified packages from the registry to check if there are any ' +
        "newly-added packages that didn't have a change file...\n" +
        '(If your PR build runs `beachball check`, it should be safe to disable this step by ' +
        'removing `new: true` from your config or removing `--new` from your publish command.)'
    );
    bumpInfo.newPackages = await getNewPackages(bumpInfo, options);
  }

  // Step 1. Bump on disk + npm publish
  // npm / yarn publish
  if (options.publish) {
    console.log('\nBumping versions and publishing to npm');
    await publishToRegistry(bumpInfo, options);
    console.log();
  } else {
    console.log('Skipping publish');
  }

  // Step 2.
  // - reset, fetch latest from origin/master (to ensure less chance of conflict),
  //   then bump on disk again + commit
  if (options.bump && branch && options.push) {
    // this does its own section logging
    await bumpAndPush(bumpInfo, publishBranch, options);
  } else {
    console.log('Skipping git push and tagging');
  }

  // Step 3.
  // Clean up: switch back to current branch, delete publish branch
  console.log('\nCleaning up');

  const revParseSuccessful = currentBranch || currentHash;
  if (currentBranch && currentBranch !== 'HEAD') {
    console.log(`git checkout ${currentBranch}`);
    gitFailFast(['checkout', currentBranch], { cwd });
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
