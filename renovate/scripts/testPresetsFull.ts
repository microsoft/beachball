import fs from 'fs';
import path from 'path';
import { checkToken, getToken } from './checkToken.ts';
import serverConfig from './serverConfig.ts';
import { getEnv } from './utils/getEnv.ts';
import { defaultRepo, isGithub, logEndGroup, logError, logGroup, logOther } from './utils/github.ts';
import { paths } from './utils/paths.ts';
import { logRenovateErrorDetails, readRenovateLogs } from './utils/renovateLogs.ts';
import { verifyRenovate, runRenovate } from './utils/runRenovate.ts';
import type { RenovatePresetDebugLog } from './utils/types.ts';

const configFilePath = path.join(import.meta.dirname, 'serverConfig.js');

async function runTests() {
  const repository = getEnv('GITHUB_REPOSITORY', isGithub);

  if (!isGithub || repository !== defaultRepo) {
    // This is possible to test against a github branch in the main repo, but won't work with fork PRs
    // or locally. In that case, exit with a warning.
    logOther(
      'warning',
      'Skipping full Renovate test run (only works after configs are checked in ' + 'or for branches in the main repo)'
    );
    process.exit(0);
  }

  await checkToken(getToken(true) || '');

  await verifyRenovate();

  fs.writeFileSync(paths.logFileFull, ''); // Renovate wants this to exist already

  logGroup('Renovate server config:');
  console.log(JSON.stringify({ ...serverConfig, token: '...' }, null, 2));
  logEndGroup();

  logGroup('Running Renovate');
  const result = await runRenovate('renovate', {
    logLevel: 'info',
    logFile: paths.logFileFull,
    logFileLevel: 'debug',
    configFile: configFilePath,
  });
  logEndGroup();

  if (result.failed) {
    logRenovateError(paths.logFileFull);
    process.exit(1);
  }
}

function logRenovateError(logFile: string) {
  const logs = readRenovateLogs(logFile);

  // If a preset fails to validate while running renovate, there's a special message config-presets-invalid.
  // (Unclear if there can be multiple of these logs, but check anyway.)
  const invalidPresetLogs = logs.filter(l => !!l.err && l.msg === 'config-presets-invalid');
  if (invalidPresetLogs.length) {
    // As of writing, there's only a debug log which directly includes the name of the preset that
    // failed to validate (it's not included in any of the higher-severity logs).
    const presetDebugLogs = logs.filter(
      l => !!l.err && (l as RenovatePresetDebugLog).preset
    ) as RenovatePresetDebugLog[];

    if (presetDebugLogs.length) {
      for (const log of presetDebugLogs) {
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
    } else {
      logError('One or more presets failed to validate');
      for (const log of invalidPresetLogs) {
        logRenovateErrorDetails(log);
      }
    }
  } else {
    const errorRollupLog = logs.find(l => l.loggerErrors);
    if (errorRollupLog?.loggerErrors?.length) {
      logError('Error while running Renovate');
      for (const log of errorRollupLog.loggerErrors) {
        logRenovateErrorDetails(log);
      }
    } else {
      logError('Running Renovate failed for an unknown reason (see logs)');
    }
  }

  logError('For debug logs, see the renovate-dry-run-log artifact.');
}

runTests().catch(err => {
  console.error((err as Error).stack || err);
  process.exit(1);
});
