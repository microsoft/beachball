import { describe, it, expect } from '@jest/globals';
import { readPresets } from './utils/readPresets.ts';
import { getLocalPresetFromExtends } from './utils/extends.ts';

// This is more of a lint rule than a test, but it's much easier to hook it in to Jest
describe('lint presets', () => {
  const schema = 'https://docs.renovatebot.com/renovate-schema.json';

  const presets = readPresets();

  describe('required attributes', () => {
    it.each(presets)('$name', ({ json }) => {
      expect(json).toHaveProperty('$schema', schema);
      expect(json).toHaveProperty('description');
    });
  });

  describe('valid extends', () => {
    const extendsPresets = presets.filter(p => p.json?.extends);
    it.each(extendsPresets)('$name', ({ json }) => {
      const invalidExtends = (json.extends || []).filter(extnds => {
        const extPreset = getLocalPresetFromExtends(extnds);
        // ignore presets from outside this repo, but ones within the repo must exist
        return extPreset && !presets.some(p => p.name === extPreset);
      });
      expect(invalidExtends).toHaveLength(0);
    });
  });
});
