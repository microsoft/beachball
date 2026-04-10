import fs from 'fs';

/**
 * Read a JSON file. Throws an informative error if parsing fails.
 */
export function readJson<T>(filePath: string): T {
  const fileContents = fs.readFileSync(filePath, 'utf-8');
  try {
    return JSON.parse(fileContents) as T;
  } catch {
    throw new Error(`Error parsing JSON file at ${filePath}. Contents:\n${fileContents}`);
  }
}
