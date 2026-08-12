import { MessageName, ReportError } from '@yarnpkg/core';
import winPath from 'node:path/win32';

const pluginName = 'yarn-plugin-npmrc';

/**
 * If the verbose option is true, log a message to the console with the plugin name as a prefix.
 * @param once If true, only log the message once (subsequent calls with the same message will be ignored)
 */
export type VerboseLogger = ((msg: string, once?: boolean) => void) & {
  /** whether verbose logging is enabled */
  verbose: boolean;
};

/**
 * Throw an error with a prefix with the plugin name.
 * This uses a special ReportError class which should cause yarn to exit.
 */
export function throwError(messageOrError: unknown): never {
  throw new ReportError(MessageName.UNNAMED, `[${pluginName}] ${(messageOrError as Error).message || messageOrError}`);
}

export function makeVerboseLogger(verbose: boolean): VerboseLogger {
  const loggedMessages = new Set<string>();
  const log = ((msg, once) => {
    if (!verbose || (once && loggedMessages.has(msg))) {
      return;
    }
    once && loggedMessages.add(msg);
    console.log(`[${pluginName}] ${msg}`);
  }) as VerboseLogger;
  log.verbose = verbose;
  return log;
}

export function logMessage(level: 'log' | 'warn' | 'error', msg: string): void {
  console[level](`[${pluginName}] ${msg}`);
}

/**
 * Yarn formats Windows paths like `/C:/path/to/file` which is not valid.
 * Fix it for use with other tools (remove extra leading slash and normalize slashes).
 */
export function fixWindowsPath(pth: string): string {
  return pth && process.platform === 'win32' ? winPath.normalize(pth.replace(/^\/([a-z]:)/i, '$1')) : pth;
}
