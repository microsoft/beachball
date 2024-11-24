// @ts-check
import globals from 'globals';
import { includeIgnoreFile } from '@eslint/compat';
import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';
import path from 'path';
import { fileURLToPath } from 'url';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default tseslint.config(
  includeIgnoreFile(path.join(dirname, '.gitignore')),
  includeIgnoreFile(path.join(dirname, '.prettierignore')),
  {
    ignores: ['docs/**/*', 'docs/.vuepress/**/*'],
  },
  // switch to nodeBuiltin if using ESM
  { languageOptions: { globals: globals.node } },
  pluginJs.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
    rules: {
      '@typescript-eslint/consistent-generic-constructors': 'error',
      '@typescript-eslint/consistent-type-assertions': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { disallowTypeAnnotations: false }],
      '@typescript-eslint/consistent-type-exports': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/no-deprecated': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-shadow': 'error',
      '@typescript-eslint/no-unused-expressions': ['error', { allowShortCircuit: true }],
      '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }],
      '@typescript-eslint/prefer-for-of': 'error',

      // Downgrade these rules to warnings because they cause excessive/unhelpful noise when
      // the actual problem is type errors due to a missing import...
      // With the rules as warnings, there will only be "red squiggles" at the spot of the type error
      // rather than sometimes covering the whole statement.
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',

      // disabled until ESM migration
      '@typescript-eslint/no-require-imports': 'off',

      // disabled permanently
      // This rule requires using Record instead of index signatures, and it's disabled because
      // sometimes the key name can be useful for documentation.
      '@typescript-eslint/consistent-indexed-object-style': 'off',
      // Don't restrict types of `template expression ${operands}`.
      '@typescript-eslint/restrict-template-expressions': 'off',
      // incorrectly flags spaces in snapshots
      'no-regex-spaces': 'off',
    },
  },
  {
    files: ['src/**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    files: ['src/__*/**/*'],
    rules: {
      'no-restricted-properties': [
        'error',
        ...['describe', 'it', 'test']
          .map(func => [
            { object: func, property: 'only', message: 'Do not commit .only() tests' },
            { object: func, property: 'skip', message: 'Do not commit .skip() tests (disable this rule if needed)' },
          ])
          .flat(),
      ],
    },
  },
  {
    files: ['**/*.{js,cjs,mjs}'],
    extends: [tseslint.configs.disableTypeChecked],
  }
);
