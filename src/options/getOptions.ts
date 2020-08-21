import { BeachballOptions } from '../types/BeachballOptions';
import { getCliOptions } from './getCliOptions';
import { getRootOptions } from './getRootOptions';
import { getDefaultOptions } from './getDefaultOptions';

/**
 * Gets all repo level options (default + root options + cli options)
 */
export function getOptions(): BeachballOptions {
  return { ...getDefaultOptions(), ...getRootOptions(), ...getCliOptions() };
}
