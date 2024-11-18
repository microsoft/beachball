import { BeachballOptions } from '../types/BeachballOptions';
import { cliOptions } from './cliOptions';

const defaults = Object.fromEntries(
  Object.entries(cliOptions)
    .filter(([, val]) => 'default' in val)
    .map(([key, val]) => {
      const defaultValue = val.default!;
      if (defaultValue && typeof defaultValue === 'object' && 'simpleValue' in defaultValue) {
        return [key, defaultValue.simpleValue];
      }
      return [key, defaultValue];
    })
);

/**
 * Default options, used for tests.
 */
export function getDefaultOptions(): BeachballOptions {
  return {
    ...defaults,
    generateChangelog: true,
  } as BeachballOptions;
}
