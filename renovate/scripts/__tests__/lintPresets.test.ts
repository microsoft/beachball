import { describe, it, expect } from '@jest/globals';
import { readPresets, readRepoConfig } from '../utils/readPresets.ts';
import { getLocalPresetFromExtends } from '../utils/extends.ts';
import type { BasicRenovateConfig } from '../utils/types.ts';

// This is more of a lint rule than a test, but it's much easier to hook it in to Jest
describe('lint presets', () => {
  const schema = 'https://docs.renovatebot.com/renovate-schema.json';

  const presets = readPresets();
  const repoConfig = readRepoConfig();

  function getInvalidExtends(json: BasicRenovateConfig): string[] {
    return (json.extends || []).filter(extnds => {
      const extPreset = getLocalPresetFromExtends(extnds);
      // ignore presets from outside this repo, but ones within the repo must exist
      return extPreset && !presets.some(p => p.name === extPreset);
    });
  }

  describe.each([repoConfig, ...presets])('$name', preset => {
    const { json } = preset;

    it('has required properties', () => {
      expect(json).toHaveProperty('$schema', schema);
      preset !== repoConfig && expect(json).toHaveProperty('description');
    });

    json.extends &&
      it('extends only valid presets', () => {
        expect(getInvalidExtends(json)).toHaveLength(0);
      });
  });
});
