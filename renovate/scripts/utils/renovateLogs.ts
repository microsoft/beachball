import fs from 'fs';
import { logEndGroup, logGroup } from './github.ts';
import type { RenovateLog, RenovateLogLevelName, RenovateLogLevelValue } from './types.ts';

const logLevelStrings: Record<RenovateLogLevelValue, string> = {
  10: 'trace',
  20: 'debug',
  30: 'info',
  40: 'warn',
  50: 'error',
  60: 'fatal',
};

export type RenovateEnvParams = {
  /** Log level for console output (default info) */
  logLevel?: RenovateLogLevelName;
  /** Log format for console output (default pretty) */
  logFormat?: 'json' | 'pretty';
  /** Path to a log file */
  logFile?: string;
  /** Log level for the log file */
  logFileLevel?: RenovateLogLevelName;
  /** Log format for the log file (default json) */
  logFileFormat?: 'json' | 'pretty';
  /** Path to the config file */
  configFile?: string;
};

/**
 * @returns Environment variables to set for Renovate
 */
export function getRenovateEnv(params: RenovateEnvParams): Record<string, string> {
  const { logLevel, logFormat, logFile, logFileLevel, logFileFormat, configFile } = params;
  return {
    ...(logLevel && { LOG_LEVEL: logLevel }),
    ...(logFormat && { LOG_FORMAT: logFormat }),
    ...(logFile && { LOG_FILE: logFile }),
    ...(logFileLevel && { LOG_FILE_LEVEL: logFileLevel }),
    ...(logFileFormat && { LOG_FILE_FORMAT: logFileFormat }),
    ...(configFile && { RENOVATE_CONFIG_FILE: configFile }),
  };
}

/**
 * Read a Renovate log file, which has entries in JSON format.
 */
export function readRenovateLogs(logFile: string): RenovateLog[] {
  // Each line in the log file is a JSON blob
  return fs
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

/**
 * @param all whether to print all the extra properties
 * (exception: for logs with errors, always prints all properties)
 */
export function formatRenovateLog(log: RenovateLog, all?: boolean): string {
  // destructure a bunch of extra properties to get rid of them from the logged object
  const { msg, level, time, name, hostname, pid, logContext, v, ...rest } = log;

  // basic message and level (like what Renovate logs)
  let res = `${logLevelStrings[level].padEnd(5)} ${msg}`;

  if ((all && Object.keys(rest).length) || rest.err) {
    // add the extra properties in a format similar to what Renovate uses
    // (JSON but with start and end braces removed)
    res += '\n' + JSON.stringify(rest, null, 2).split('\n').slice(1, -1).join('\n');
  }
  return res;
}
