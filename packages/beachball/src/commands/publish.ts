import { gatherBumpInfo } from '../bump/gatherBumpInfo';
import { BeachballOptions } from '../types/BeachballOptions';
import { gitFailFast, getBranchName } from '../git';
import prompts from 'prompts';
import { getPackageChangeTypes } from '../changefile/getPackageChangeTypes';
import { readChangeFiles } from '../changefile/readChangeFiles';
import { bumpAndPush } from '../publish/bumpAndPush';
import { publishToRegistry } from '../publish/publishToRegistry';
export async function publish(options: BeachballOptions) {
  const { path: cwd, branch, registry, tag } = options;
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
