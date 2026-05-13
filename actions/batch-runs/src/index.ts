import * as core from '@actions/core';
import {
  checkForNewerRuns,
  cancelRun,
  getEnumInput,
  onUnhandledError,
} from '@microsoft/beachball-actions-common';

const main = async (): Promise<void> => {
  const mode = getEnumInput('mode', ['cancel', 'output'] as const, 'cancel');
  const token = core.getInput('token', { required: true });

  const shouldCancel = await checkForNewerRuns(token);
  if (mode === 'cancel') {
    await cancelRun(token);
  } else {
    core.setOutput('shouldCancel', shouldCancel ? 'yes' : 'no');
  }
};

main().catch(onUnhandledError);
