// Entry point for the ESRP npm release tool.
// Reads packed packages (produced by `beachball publish --pack-to-path <path>`),
// zips each layer, and publishes them to npmjs.com via the ESRP Release API in dependency order.
//
// Based on the non-worker part of https://github.com/microsoft/vscode/blob/main/build/azure-pipelines/common/publish.ts
// called by https://github.com/microsoft/vscode/blob/main/build/azure-pipelines/product-publish.yml#L106
//
// This file owns the only direct touchpoints with `process.env` and `process.exit` in the
// package; the actual orchestration lives in `runRelease` so it can be unit-tested.

import { getEnvOptions } from './getEnvOptions.ts';
import { runRelease } from './runRelease.ts';
import { Logger } from './utils/Logger.ts';
import { ReleaseError } from './utils/ReleaseError.ts';

const logger = new Logger();

await runRelease({ env: getEnvOptions(), logger }).catch(err => {
  if (err instanceof ReleaseError && err.alreadyLogged) {
    // Error details were already printed -- just exit
  } else if (err instanceof ReleaseError) {
    // Expected error, not yet logged -- print the message and cause message (no stack trace)
    logger.error(err.getMessageWithCause());
  } else {
    // Unexpected error -- print full details including stack
    logger.error('Unexpected error while running release!');
    logger.error((err as Error)?.stack || err);
  }
  // eslint-disable-next-line no-restricted-properties
  process.exit(1);
});
