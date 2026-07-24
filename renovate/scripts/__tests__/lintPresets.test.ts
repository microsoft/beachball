import { describe, it, expect } from '@jest/globals';
import { readPresets, readRepoConfig } from '../utils/readPresets.ts';
import { getLocalPresetFromExtends } from '../utils/extends.ts';

// This is more like a lint rule, but it's much easier to implement in Jest
describe('lint presets', () => {
  const schema = 'https://docs.renovatebot.com/renovate-schema.json';

  const presets = readPresets();
  const repoConfig = readRepoConfig();

  describe.each([repoConfig, ...presets])('$name', preset => {
    const { json } = preset;

    it('has required properties', () => {
      expect(json).toHaveProperty('$schema', schema);
      preset !== repoConfig && expect(json).toHaveProperty('description');
    });

    json.extends &&
      it('does not extend nonexistent local presets', () => {
        const invalidExtends = (json.extends || []).filter(extnds => {
          // ignore presets from outside this repo, but ones within the repo must exist
          const extendsName = getLocalPresetFromExtends(extnds);
          return extendsName && !presets.some(p => p.name === extendsName);
        });
        expect(invalidExtends).toHaveLength(0);
      });

    json.extends &&
      preset !== repoConfig &&
      it('does not combine local extends and other non-extends settings', () => {
        const hasLocalExtends = json.extends?.some(e => getLocalPresetFromExtends(e));
        if (hasLocalExtends) {
          const { extends: extnds, $schema, description, ...rest } = json;
          // See comment in extends.ts getExtendsForServerConfig
          expect(rest).toEqual({});
        }
      });
  });
});
