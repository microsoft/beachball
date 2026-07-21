import fs from 'fs';
import jju from 'jju';
import path from 'path';
import { logError } from './github.ts';
import { paths } from './paths.ts';
import type { BasicRenovateConfig, ConfigData, LocalPresetData } from './types.ts';

export const specialConfigNames = {
  serverConfig: 'server config',
  repoConfig: 'repo config',
};

/**
 * Get the contents of the preset files.
 */
export function readPresets(params: { exclude?: string[] } = {}): LocalPresetData[] {
  const excludePresets = params?.exclude ?? [];
  const presetFiles = fs
    .readdirSync(paths.presetsRoot)
    .filter(file => /^[^.].*\.json$/.test(file))
    .sort();

  if (!presetFiles.length) {
    logError('No presets found under ' + paths.presetsRoot);
    process.exit(1);
  }

  return presetFiles
    .filter(f => !excludePresets.includes(path.basename(f, '.json')))
    .map(preset => {
      const presetName = path.basename(preset, '.json');
      const presetPath = path.join(paths.presetsRoot, preset);
      const content = fs.readFileSync(presetPath, 'utf8');
      return {
        absolutePath: presetPath,
        name: presetName,
        filename: preset,
        content,
        json: JSON.parse(content) as BasicRenovateConfig,
      };
    });
}

/** Read the repo `renovate.json5` */
export function readRepoConfig(): LocalPresetData {
  const content = fs.readFileSync(paths.repoRenovateConfig, 'utf8');
  return {
    absolutePath: paths.repoRenovateConfig,
    content,
    name: specialConfigNames.repoConfig,
    json: jju.parse(content) as BasicRenovateConfig,
  };
}

/** Get server config info without contents */
export function getServerConfig(): ConfigData {
  return {
    absolutePath: paths.serverConfig,
    name: specialConfigNames.serverConfig,
  };
}
