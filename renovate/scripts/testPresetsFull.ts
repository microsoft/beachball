import fs from 'fs';
import { checkToken, getToken } from './checkToken.ts';
import serverConfig from './serverConfig.ts';
import { defaultRepo, isGithub, logEndGroup, logError, logGroup } from './utils/github.ts';
import { paths } from './utils/paths.ts';
import { logRenovateErrorDetails, parseRenovateLogs, type ParsedRenovateLogs } from './utils/renovateLogs.ts';
import { runRenovate, verifyRenovate } from './utils/runBin.ts';

async function runTests() {
  if (!isGithub) {
    // In the real run, config content is pulled from the repo, so this can only run after
    logError("Can't run full Renovate test locally (only works after configs are pushed)");
    process.exit(1);
  }

  await checkToken(getToken(true) || '');

  await verifyRenovate();

  fs.writeFileSync(paths.logFileFull, ''); // Renovate wants this to exist already

  logGroup('Renovate server config:');
  console.log(JSON.stringify({ ...serverConfig, token: '...' }, null, 2));
  logEndGroup();

  logGroup('Running Renovate');
  const result = await runRenovate('renovate', {
    logFile: paths.logFileFull,
    configFile: paths.serverConfig,
  });
  logEndGroup();

  const parsed = parseRenovateLogs(paths.logFileFull);
  if (result.failed || parsed.errors.length || parsed.warnings.length || parsed.repoProblems?.length) {
    logRenovateError(parsed);
    process.exit(1);
  }
}

function logRenovateError(parsed: ParsedRenovateLogs) {
  const repositoryResult = parsed.resultLog?.result;
  if (typeof repositoryResult === 'string' && repositoryResult !== 'done') {
    logError(`Renovate repository result was "${repositoryResult}"`);
  }

  // It's not at all clear which of these appear when...
  const { presetErrLogs, errorRollupLog } = parsed;
  if (presetErrLogs.length) {
    for (const log of presetErrLogs) {
      const maybeHttpError = log.err?.err as
        { response?: { statusCode?: number }; options?: { url?: string } } | undefined;
      if (maybeHttpError?.response?.statusCode === 404) {
        const url = maybeHttpError.options?.url;
        if (url?.includes(defaultRepo) && !url.includes('?ref=')) {
          logError(
            `Preset "${log.preset}" not found at URL: ${url}\n` +
              'This is expected if the preset was added in this PR and another preset extends it.'
          );
        } else {
          logError(`Preset "${log.preset}" not found (404)`);
          logRenovateErrorDetails(log);
        }
      } else {
        logError(`Preset "${log.preset}" is invalid`);
        logRenovateErrorDetails(log);
      }
    }
  } else if (parsed.repoProblems?.length) {
    logError('Renovate reported problems with the repository:');
    for (const problem of parsed.repoProblems) {
      console.log(`  - ${problem}`);
    }
  } else if (errorRollupLog?.loggerErrors?.length) {
    logError('Error while running Renovate');
    for (const log of errorRollupLog.loggerErrors) {
      logRenovateErrorDetails(log);
    }
  } else {
    logError('Running Renovate failed for an unknown reason (see logs)');
  }

  logError('For debug logs, see the renovate-dry-run-log artifact.');
}

runTests().catch(err => {
  console.error((err as Error).stack || err);
  process.exit(1);
});
