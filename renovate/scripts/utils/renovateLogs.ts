import fs from 'fs';
import { logEndGroup, logGroup } from './github.ts';
import type { RenovateLog, RenovateLogLevelName } from './types.ts';

export type RenovateEnvParams = {
  /** Log level for pretty console output (default warn) */
  logLevel?: RenovateLogLevelName;
  /** Path to a log file */
  logFile: string;
  /** Path to the config file (required for `renovate` but not `renovate-config-validator`) */
  configFile?: string;
};

export type ParsedRenovateLogs = {
  /** migrated config (possibly validation only) */
  migratedConfig?: unknown;
  /** new config/alt migration message? (possibly validation only) */
  newConfig?: unknown;
  /** final "Repository finished" log with a `result` */
  resultLog?: RenovateLog & Required<Pick<RenovateLog, 'result'>>;
  errorRollupLog?: RenovateLog & Required<Pick<RenovateLog, 'loggerErrors'>>;
  presetErrLogs: Array<RenovateLog & Required<Pick<RenovateLog, 'preset' | 'err'>>>;
  repoProblems?: string[];
  warnings: string[];
  errors: string[];
};

/**
 * @returns Environment variables to set for Renovate
 */
export function getRenovateEnv(params: RenovateEnvParams): Record<string, string> {
  const { logLevel = 'info', logFile, configFile } = params;
  return {
    LOG_LEVEL: logLevel,
    // write a JSON log file
    LOG_FILE: logFile,
    LOG_FILE_LEVEL: 'debug',
    ...(configFile && { RENOVATE_CONFIG_FILE: configFile }),
  };
}

/**
 * Read a Renovate log file, which has entries in JSON format, and look for known contents.
 * @param startMarker The log file may contain info from multiple validation runs.
 * If provided, only return logs after the first log with `customStartMarker` as this string.
 */
export function parseRenovateLogs(logFile: string, startMarker?: string): ParsedRenovateLogs {
  // Each line in the log file is a JSON blob
  let logs = fs
    .readFileSync(logFile, 'utf8')
    .trim()
    .split(/\r?\n/g)
    .map(str => {
      try {
        return JSON.parse(str) as RenovateLog;
      } catch {
        // ignore
      }
    })
    .filter(l => !!l);
  const startIndex = startMarker ? logs.findIndex(l => l.customStartMarker === startMarker) : -1;
  logs = startIndex >= 0 ? logs.slice(startIndex) : logs;

  let migratedConfig: unknown;
  let newConfig: unknown;
  const presetErrLogs: ParsedRenovateLogs['presetErrLogs'] = [];
  const errorMessages: string[] = [];
  const warningMessages: string[] = [];

  for (const log of logs) {
    if (log.migratedConfig) {
      migratedConfig = log.migratedConfig;
    } else if (log.newConfig) {
      newConfig = log.newConfig;
    } else if (log.errors?.[0]?.message) {
      errorMessages.push(...log.errors.map(e => e.message));
    } else if (log.warnings?.[0]?.message) {
      warningMessages.push(...log.warnings.map(w => w.message));
    }
    // As of writing, there's only a debug log which directly includes the name of the preset that
    // failed to validate (it's not included in any of the higher-severity logs).
    // (the err-presets-invalid thing might be old)
    if (log.preset && log.err) {
      presetErrLogs.push(log as RenovateLog & Required<Pick<RenovateLog, 'preset' | 'err'>>);
    }
  }

  return {
    migratedConfig,
    newConfig,
    resultLog: logs.findLast(l => l.msg === 'Repository finished' && l.result) as ParsedRenovateLogs['resultLog'],
    errorRollupLog: logs.findLast(l => l.loggerErrors?.length) as ParsedRenovateLogs['errorRollupLog'],
    presetErrLogs,
    repoProblems: logs.findLast(l => l.repoProblems?.length)?.repoProblems,
    // dedupe messages
    warnings: [...new Set(warningMessages)],
    errors: [...new Set(errorMessages)],
  };
}

export function logRenovateErrorDetails(log: RenovateLog): void {
  const { err } = log;
  if (!err) return;

  logGroup('Error details');

  // Typically the inner error in Renovate logs is the one with interesting content.
  // For example, if a preset name is invalid, this is where you'll find the 404 HTTPError.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  const innerError = err.err as (Error & { options?: { url?: string } }) | undefined;
  if (innerError?.name === 'HTTPError') {
    console.log(`HTTP error requesting ${innerError.options?.url}`);
    console.log(innerError.message);
  }

  // The outer error will likely have a better stack in the case of async HTTP errors
  console.log('\nOuter error:');
  console.log(err.stack);

  if (innerError) {
    console.log('\nOriginal error:');
    console.log(JSON.stringify(innerError, null, 2));
  }

  logEndGroup();
}
