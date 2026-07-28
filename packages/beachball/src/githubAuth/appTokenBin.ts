import { env } from '../env';
import { BeachballError } from '../types/BeachballError';
import { runAppTokenCli } from './appTokenCli';

// This is a separate file so most of the CLI can be tested in Jest
void runAppTokenCli({ argv: process.argv }).catch((err: unknown) => {
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
