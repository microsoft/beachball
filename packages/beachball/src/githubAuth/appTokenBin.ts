import { env } from '../env';
import { runAppTokenCli } from './appTokenCli';
import { AuthError } from './validationHelpers';

// This is a separate file so most of the CLI can be tested in Jest
void runAppTokenCli({ argv: process.argv }).catch((err: unknown) => {
  const message =
    err instanceof AuthError ? err.message : err instanceof Error ? err.stack || err.message : String(err);
  const errorPrefix = env.isAzurePipelines ? '##vso[task.logissue type=error] ' : '';
  console.error(`${errorPrefix}${message}`);
  process.exitCode = 1;
});
