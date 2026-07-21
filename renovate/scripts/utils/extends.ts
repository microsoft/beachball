import path from 'path';
import { defaultRepo } from './github.ts';
import type { LocalPresetData } from './types.ts';

export const repoPresetPrefix = `github>${defaultRepo}//renovate/presets/`;

/**
 * If `extendsStr` points to a preset from this repo, get its name.
 * Returns undefined otherwise. (Doesn't verify that the preset name exists.)
 */
export function getLocalPresetFromExtends(extendsStr: string): string | undefined {
  return extendsStr.startsWith(repoPresetPrefix) ? extendsStr.split(repoPresetPrefix)[1]?.split(/[#(]/)[0] : undefined;
}

/**
 * Get a reference to a local preset for use in an `extends` config.
 * (Doesn't verify that the preset name exists.)
 */
export function getExtendsForLocalPreset(preset: LocalPresetData, ref?: string): string {
  const presetName = path.basename(preset.name, '.json');
  const presetArg0 = preset.content.includes('{{arg0}}') ? '(16)' : '';
  const presetRef = ref ? `#${ref}` : '';
  return `${repoPresetPrefix}${presetName}${presetRef}${presetArg0}`;
}
