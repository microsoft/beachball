import * as core from '@actions/core';

export function onUnhandledError(err: unknown) {
  if (err instanceof Error) {
    console.error(err.stack);
    console.error('Full error object: ' + JSON.stringify(err));
    core.setFailed(err.message);
  } else {
    core.setFailed(JSON.stringify(err));
  }
  process.exit(1);
}
