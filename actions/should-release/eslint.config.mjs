// @ts-check
import { getConfig } from '@microsoft/beachball-scripts/config/eslint.ts';

export default getConfig(import.meta.dirname, {
  rules: {
    'no-restricted-properties': 'off',
  },
});
