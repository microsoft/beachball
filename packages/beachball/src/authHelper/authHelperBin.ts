import { env } from '../env';
import { BeachballError } from '../types/BeachballError';
import { runAuthHelperCli } from './authHelperCli';

// eslint-disable-next-line no-restricted-properties -- top-level call
const processCwd = process.cwd();

// This is a separate file so most of the CLI can be tested in Jest
void runAuthHelperCli({ argv: process.argv, cwd: processCwd }).catch((err: unknown) => {
  let message: string;
  let shouldLog = true;
  if (err instanceof BeachballError) {
    message = err.message;
    shouldLog = !err.alreadyLogged;
  } else {
    message = err instanceof Error ? err.stack || err.message : String(err);
  }
  const errorPrefix = env.isAzurePipelines ? '##vso[task.logissue type=error] ' : '';
  shouldLog && console.error(`${errorPrefix}${message}`);
  process.exitCode = 1;
});
