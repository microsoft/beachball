import * as core from '@actions/core';
import * as glob from '@actions/glob';
import fs from 'fs';
import path from 'path';
import {
  checkForNewerRuns,
  cancelRun,
  getEnumInput,
  onUnhandledError,
} from '@microsoft/beachball-actions-common';

async function main() {
  const batch = core.getBooleanInput('batch');
  const changeGlob = core.getInput('changeGlob');
  const mode = getEnumInput('mode', ['cancel', 'output'] as const, 'cancel');
  const token = core.getInput('token', { required: true });

  let shouldRelease = true;

  core.debug('cwd: ' + process.cwd());
  const globDir = path.join(process.cwd(), path.dirname(changeGlob));
  if (fs.existsSync(globDir)) {
    core.debug(
      `files in ${globDir}: ${fs
        .readdirSync(globDir)
        .map((f) => `\n  ${f}`)
        .join('')}`,
    );
  }
  const changeFiles = await (await glob.create(changeGlob)).glob();
  if (changeFiles.length === 0) {
    shouldRelease = false;
    core.info('No change files found.');
  } else if (batch && (await checkForNewerRuns(token))) {
    shouldRelease = false;
  }

  if (mode === 'cancel') {
    await cancelRun(token);
  } else {
    const result = shouldRelease ? 'yes' : 'no';
    core.info(`Should release: ${result}`);
    core.setOutput('shouldRelease', result);
  }
}

main().catch(onUnhandledError);
