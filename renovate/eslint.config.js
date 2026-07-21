// @ts-check
import { getConfig } from '@microsoft/beachball-scripts/config/eslint.ts';

export default getConfig(import.meta.dirname, {
  rules: {
    // allow process.exit etc
    'no-restricted-properties': 'off',
  },
});
