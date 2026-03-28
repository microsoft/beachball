import path from 'path';
import type { PackageJson } from './types/PackageInfo';
import { readJson } from './object/readJson';

export function showVersion(): void {
  const packageJson = readJson<PackageJson>(path.resolve(__dirname, '../package.json'));
  console.log(`beachball v${packageJson.version} - the sunniest version bumping tool`);
}
