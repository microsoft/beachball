import { BeachballOptions } from '../types/BeachballOptions';
import { promptForChange } from '../changefile/promptForChange';
import { writeChangeFiles } from '../changefile/writeChangeFiles';

export async function change(options: BeachballOptions) {
  const changes = await promptForChange(options);

  if (changes) {
    writeChangeFiles(changes, options.path);
  }
}
