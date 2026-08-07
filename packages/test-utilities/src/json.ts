import fs from 'node:fs';

/** Read a JSON file. Throws an informative error if parsing fails. */
export function readJson<T>(filePath: string): T {
  const fileContents = fs.readFileSync(filePath, 'utf-8');
  try {
    return JSON.parse(fileContents) as T;
  } catch {
    throw new Error(`Error parsing JSON file at ${filePath}. Contents:\n${fileContents}`);
  }
}

/** Write a JSON file. */
export function writeJson(filePath: string, data: unknown): void {
  const fileContents = JSON.stringify(data, null, 2) + '\n';
  fs.writeFileSync(filePath, fileContents, 'utf-8');
}

/** Shallow-merge the given updates with an existing JSON file. */
export function updateJson(filePath: string, updates: object): void {
  if (!filePath.endsWith('.json')) {
    throw new Error('This method only works with json files');
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`JSON file does not exist: ${filePath}`);
  }
  const oldContent = readJson<object>(filePath);
  writeJson(filePath, { ...oldContent, ...updates });
}
