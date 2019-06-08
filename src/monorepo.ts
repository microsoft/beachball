import { searchUp } from './paths';
import fs from 'fs';
import path from 'path';

export function findLernaConfig(cwd?: string) {
  return searchUp('lerna.json', cwd);
}

export function getPackagePatterns(cwd?: string): string[] {
  const config = findLernaConfig(cwd);

  if (config) {
    try {
      const lernaConfig = JSON.parse(fs.readFileSync(path.join(config, 'lerna.json')).toString());
      return lernaConfig.packages || ['packages/*'];
    } catch (e) {
      throw new Error('Cannot parse the lerna.json configuration file!');
    }
  }

  return [];
}
