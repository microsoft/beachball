import { BeachballOptions } from '../types/BeachballOptions';
import { promptForChange } from '../changefile/promptForChange';
import { writeChangeFiles } from '../changefile/writeChangeFiles';

/**
 * Prompt for changes and write change files.
 * Assumes options have already been validated.
 */
export async function change(options: BeachballOptions) {
  const changes = await promptForChange(options);

  if (changes) {
    writeChangeFiles(changes, options.path, options.commit);
  }
}
