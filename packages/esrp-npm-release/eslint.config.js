// @ts-check
import { getConfig } from '@microsoft/beachball-scripts/config/eslint.ts';

export default getConfig(import.meta.dirname, {
  rules: {
    // Use Logger instead or throw errors
    'no-console': 'error',
    '@typescript-eslint/explicit-member-accessibility': ['error', { accessibility: 'explicit' }],
  },
});
