import { bulletedList } from '../logging/bulletedList';
import { BeachballError } from '../types/BeachballError';
import type { ParsedOptions } from '../types/BeachballOptions';

/**
 * Handles the `beachball migrate` command.
 *
 * Checks the config for any settings that need to be updated for v3 and logs them to the console.
 * If no updates are needed, a success message is printed.
 */
export function migrate(parsedOptions: ParsedOptions): void {
  const { options } = parsedOptions;
  const updates: string[] = [];

  if ((options as { new?: boolean }).new !== undefined) {
    updates.push('The `new` option has been removed. Please remove it from your config.');
  }

  if (updates.length === 0) {
    console.log('No config updates are needed for v3.');
  } else {
    console.error('The following updates are needed for v3:');
    console.error(bulletedList(updates) + '\n');
    throw new BeachballError('Config updates needed', { alreadyLogged: true });
  }
}
