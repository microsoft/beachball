import path from 'path';
import { defaultRepo } from './github.ts';
import type { BasicRenovateConfig, LocalPresetData } from './types.ts';

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
export function getExtendsForLocalPreset(preset: Pick<LocalPresetData, 'name' | 'content'>, ref?: string): string {
  const presetName = path.basename(preset.name, '.json');
  const presetArg0 = preset.content.includes('{{arg0}}') ? '(16)' : '';
  const presetRef = ref ? `#${ref}` : '';
  return `${repoPresetPrefix}${presetName}${presetRef}${presetArg0}`;
}

/** Returns true if the config extends a preset from this repo. */
export function extendsLocalPreset(config: BasicRenovateConfig): boolean {
  return !!config.extends?.some(e => getLocalPresetFromExtends(e));
}

/**
 * Get an `extends` config for the server config that will be valid for either `main` or a PR.
 *
 * If `branchRef` is undefined, all presets are included without a ref.
 *
 * If `branchRef` is specified (for a full renovate dry run in a PR):
 * - Include `#branchRef` for each in-repo preset
 * - Omit any presets which extend any other local presets, since those references would be
 *   resolved relative to `main` (which is misleading, and causes errors if the referenced
 *   preset is new in the PR)
 * - For any such omitted presets, if they have `extends` references to built-in presets, include
 *   those in the final `extends` array to validate that they still exist in Renovate.
 *   (`lintPresets.test.ts` ensures that these are the only other settings included in such presets.)
 *
 * @param presets All presets in this repo
 * @param branchRef If provided, attach this ref to each preset reference, and omit any presets
 * that extend other local presets
 */
export function getServerConfigExtends(presets: LocalPresetData[], branchRef?: string): string[] {
  if (!branchRef) {
    return presets.map(p => getExtendsForLocalPreset(p));
  }

  const filteredPresets: LocalPresetData[] = [];
  const extraExtends: string[] = [];
  for (const preset of presets) {
    const extnds = preset.json.extends || [];
    const localExtends = extnds.filter(e => getLocalPresetFromExtends(e));
    if (localExtends?.length) {
      if (localExtends.length !== extnds.length) {
        extraExtends.push(...extnds.filter(e => !localExtends.includes(e)));
      }
    } else {
      filteredPresets.push(preset);
    }
  }
  return [...extraExtends, ...filteredPresets.map(p => getExtendsForLocalPreset(p, branchRef))];
}
