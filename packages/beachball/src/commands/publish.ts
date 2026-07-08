import prompts from 'prompts';
import { getBranchName, getCurrentHash, git, gitFailFast } from 'workspace-tools';
import { bumpInMemory } from '../bump/bumpInMemory';
import { bumpAndPush } from '../publish/bumpAndPush';
import { publishToRegistry } from '../publish/publishToRegistry';
import type { BeachballOptions } from '../types/BeachballOptions';
import type { BumpInfo } from '../types/BumpInfo';
import type { CommandContext } from '../types/CommandContext';
import { checkNpmAuthEnvPassthrough } from '../packageManager/npmAuthEnvPassthrough';

/**
 * Potentially bump, publish, and push package changes depending on options.
 * @param context Command context from `validate()`
 */
export async function publish(options: BeachballOptions, context: CommandContext): Promise<void> {
  console.log('Preparing to publish\n');

  const { path: cwd, branch, registry, tag, packToPath } = options;

  // First, validate that we have changes to publish
  const { changeSet: changes } = context;

  if (!changes.length) {
    console.log('Nothing to bump - skipping publish!\n');
    return;
  }

  const currentBranch = getBranchName({ cwd });
  const currentHash = getCurrentHash({ cwd });
  const shouldBumpAndPush = !!(options.bump && options.push && branch);

  console.log(`Publishing with the following configuration:

  registry: ${registry}

  current branch: ${currentBranch}
  current hash: ${currentHash}
  target branch: ${branch}
  npm dist-tag: ${tag}

  bumps versions before ${packToPath ? 'packing' : 'publishing'}: ${options.bump ? 'yes' : 'no'}
  ${
    packToPath
      ? `packs to path instead of publishing to npm registry: ${packToPath}`
      : `publishes to npm registry: ${options.publish ? 'yes' : 'no'}`
  }
  pushes bumps${options.generateChangelog ? ' and changelogs' : ''} to remote git repo: ${
    shouldBumpAndPush ? 'yes' : 'no'
  }

`);

  if (!options.yes) {
    const response = await prompts({
      type: 'confirm',
      name: 'yes',
      message: 'Is everything correct? (use the --yes or -y arg to skip this prompt)',
    });
    if (!response.yes) {
      return;
    }
    console.log();
  }

  if (options.token) {
    // Verify that passing the npm auth token via env vars works (see function comment...)
    await checkNpmAuthEnvPassthrough(options);
  }

  // checkout publish branch
  const publishBranch = `publish_${Date.now()}`;

  console.log(`Creating temporary publish branch ${publishBranch}\n`);
  gitFailFast(['checkout', '-b', publishBranch], { cwd });

  if (!context.bumpInfo) {
    // This only applies for legacy usage (not by beachball directly)
    console.log(`Gathering info ${options.bump ? 'to bump versions' : 'about versions and changes'}\n`);
    context.bumpInfo = bumpInMemory(options, context);
  }
  const bumpInfo: BumpInfo = context.bumpInfo;

  // Step 1. Bump on disk + npm publish
  // npm / yarn publish
  if (options.publish || packToPath) {
    const publishMessage = packToPath ? `packing packages to ${packToPath}` : 'publishing packages to npm registry';
    const message = options.bump
      ? `Bumping versions and ${publishMessage}`
      : publishMessage[0].toUpperCase() + publishMessage.slice(1);
    console.log(`${message}\n`);

    await publishToRegistry(bumpInfo, options);
    console.log();
  } else {
    console.log('Skipping publish\n');
  }

  // Step 2.
  // - reset, fetch latest from origin/master (to ensure less chance of conflict),
  //   then bump on disk again + commit
  if (shouldBumpAndPush) {
    // Resolve the commit message: an explicit `--message` (or `message` config value) takes
    // precedence, then the `commitMessage` config function, then the default.
    options.message =
      options.message ||
      (options.commitMessage
        ? await options.commitMessage(options, bumpInfo.packageInfos, bumpInfo)
        : 'applying package updates');

    // this does its own section logging
    await bumpAndPush(bumpInfo, publishBranch, options);
  } else {
    console.log('Skipping git push and tagging\n');
  }

  // Step 3.
  // Clean up: switch back to current branch, delete publish branch
  console.log('Cleaning up\n');

  if (currentBranch && currentBranch !== 'HEAD') {
    console.log(`git checkout ${currentBranch}`);
    gitFailFast(['checkout', currentBranch], { cwd });
  } else if (currentHash) {
    console.log(`Looks like the repo was detached from a branch`);
    console.log(`git checkout ${currentHash}`);
    gitFailFast(['checkout', currentHash], { cwd });
  }

  if (currentBranch || currentHash) {
    console.log(`deleting temporary publish branch ${publishBranch}`);
    const deletionResult = git(['branch', '-D', publishBranch], { cwd });
    if (!deletionResult.success) {
      console.warn(`[WARN]: deletion of publish branch ${publishBranch} has failed!\n${deletionResult.stderr}`);
    }
  }
}
