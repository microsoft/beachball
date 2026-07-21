import fs from 'fs';
import { runBin } from './runBin.ts';

/**
 * Update the file contents and format with Prettier
 */
export async function updateAndFormat(file: string, newContents: string): Promise<void> {
  fs.writeFileSync(file, newContents);
  await runBin('prettier', ['--write', '--log-level=warn', file]);
}
