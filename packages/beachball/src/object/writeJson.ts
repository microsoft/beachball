import fs from 'fs';

export function writeJson(filePath: string, data: unknown): void {
  const fileContents = JSON.stringify(data, null, 2) + '\n';
  fs.writeFileSync(filePath, fileContents, 'utf-8');
}
