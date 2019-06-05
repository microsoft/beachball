import { searchUp } from './paths';
import fs from 'fs';
import path from 'path';

export function findLernaConfig(cwd?: string) {
  return searchUp('lerna.json', cwd);
}

export function getPackagePatterns(cwd?: string) {
  const config = findLernaConfig(cwd);

  if (config) {
    const lernaConfig = JSON.parse(fs.readFileSync(path.join(config, 'lerna.json')).toString());
    return lernaConfig.packages || ['packages/*'];
  }

  return [];
}
