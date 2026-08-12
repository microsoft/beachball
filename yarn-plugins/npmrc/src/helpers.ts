import { MessageName, ReportError } from '@yarnpkg/core';
import type { VerboseLogger } from './types';

const pluginName = 'yarn-plugin-npmrc';

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
