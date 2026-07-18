import { MessageName, ReportError } from '@yarnpkg/core';
import { pluginName } from './constants';

/**
 * Throw an error with a prefix with the plugin name.
 * This uses a special ReportError class which should cause yarn to exit.
 */
export function throwError(messageOrError: unknown): never {
  throw new ReportError(MessageName.UNNAMED, `[${pluginName}] ${(messageOrError as Error).message || messageOrError}`);
}
