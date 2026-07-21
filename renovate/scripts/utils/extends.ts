import path from 'path';
import { defaultRepo } from './github.ts';

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
 * @param preset Preset name or path (basename will be used)
 */
export function getExtendsForLocalPreset(preset: string, ref?: string): string {
  const presetName = path.basename(preset, '.json');
  const presetRef = ref ? `#${ref}` : '';
  return `${repoPresetPrefix}${presetName}${presetRef}`;
}
