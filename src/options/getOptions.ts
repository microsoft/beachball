import type { BeachballOptions } from '../types/BeachballOptions';
import { getCliOptions } from './getCliOptions';
import { getRepoOptions } from './getRepoOptions';
import { getDefaultOptions } from './getDefaultOptions';

/**
 * Gets all repo level options (default + root options + cli options)
 */
export function getOptions(argv: string[]): BeachballOptions {
  const cliOptions = getCliOptions(argv);
  return { ...getDefaultOptions(), ...getRepoOptions(cliOptions), ...cliOptions };
}
