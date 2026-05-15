import * as core from '@actions/core';
import * as glob from '@actions/glob';
import { getEnumInput } from './getEnumInput.js';
import { checkForNewerRuns } from './checkForNewerRuns.js';
import { cancelRun } from './cancelRun.js';

async function main() {
  const batch = core.getBooleanInput('batch');
  const changeGlob = core.getInput('changeGlob');
  const mode = getEnumInput('mode', ['cancel', 'output'] as const, 'cancel');
  const token = core.getInput('token', { required: true });

  let shouldRelease = true;

  const changeFiles = await (await glob.create(changeGlob)).glob();
  if (changeFiles.length === 0) {
    shouldRelease = false;
    core.info('No change files found.');
  } else if (batch && (await checkForNewerRuns(token))) {
    shouldRelease = false;
  }

  if (mode === 'cancel') {
    if (shouldRelease) {
      core.info('Should release: yes (continuing run)');
    } else {
      await cancelRun(token);
    }
  } else {
    const result = shouldRelease ? 'yes' : 'no';
    core.info(`Should release: ${result}`);
    core.setOutput('shouldRelease', result);
  }
}

main().catch(err => {
  if (err instanceof Error) {
    console.error(err.stack);
    console.error('Full error object: ' + JSON.stringify(err));
    core.setFailed(err.message);
  } else {
    core.setFailed(JSON.stringify(err));
  }
  process.exit(1);
});
