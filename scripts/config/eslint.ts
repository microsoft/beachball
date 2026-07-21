import pluginJs from '@eslint/js';
import deprecated from '@ms-cloudpack/eslint-plugin-deprecated';
import prettier from 'eslint-config-prettier/flat';
import eslint from 'eslint/config';
import globals from 'globals';
import path from 'path';
import tseslint from 'typescript-eslint';

type ConfigWithExtendsArray = Parameters<typeof eslint.defineConfig>;

const repoRoot = path.resolve(import.meta.dirname, '../..');

export function getConfig(
  rootOrOptions:
    | string
    | {
        /** package root directory with tsconfig */
        tsconfigRootDir: string;
        /** package source files directory */
        src: string;
      },
  ...configs: ConfigWithExtendsArray
) {
  const { tsconfigRootDir, src } =
    typeof rootOrOptions === 'string' ? { tsconfigRootDir: rootOrOptions, src: 'src' } : rootOrOptions;

  return eslint.defineConfig(
    // ignores must be in separate objects to be properly respected
    eslint.includeIgnoreFile(path.join(repoRoot, '.gitignore')),
    eslint.includeIgnoreFile(path.join(repoRoot, '.prettierignore')),
    { ignores: ['lib/**/*', 'bin/**/*', '.eslintrc.js', '*.config.*'] },

    pluginJs.configs.recommended,
    tseslint.configs.recommendedTypeChecked,
    prettier,
    deprecated.configs.recommended as unknown as eslint.Config, // typescript-eslint mismatch
    {
      languageOptions: {
        globals: globals.node, // switch to nodeBuiltin if using ESM
        parserOptions: { projectService: true, tsconfigRootDir },
      },
      linterOptions: {
        reportUnusedDisableDirectives: 'error',
      },
    },
    {
      rules: {
        '@typescript-eslint/consistent-generic-constructors': 'error',
        '@typescript-eslint/consistent-type-assertions': 'error',
        '@typescript-eslint/consistent-type-imports': ['error', { disallowTypeAnnotations: false }],
        '@typescript-eslint/consistent-type-exports': 'error',
        '@typescript-eslint/explicit-module-boundary-types': 'error',
        '@typescript-eslint/naming-convention': [
          'error',
          {
            selector: 'variableLike',
            format: ['PascalCase', 'camelCase'],
            leadingUnderscore: 'allow',
          },
        ],
        '@typescript-eslint/no-import-type-side-effects': 'error',
        '@typescript-eslint/no-non-null-assertion': 'error',
        '@typescript-eslint/no-shadow': 'error',
        '@typescript-eslint/no-unused-expressions': ['error', { allowShortCircuit: true }],
        '@typescript-eslint/no-unused-vars': [
          'error',
          {
            args: 'after-used',
            // Follow the typescript pattern of ignoring things starting with _
            argsIgnorePattern: '^_',
            destructuredArrayIgnorePattern: '^_',
            varsIgnorePattern: '^_',
            ignoreRestSiblings: true,
          },
        ],
        '@typescript-eslint/prefer-for-of': 'error',
        'no-restricted-imports': [
          'error',
          {
            paths: [
              {
                name: 'node:test',
                message: 'You probably meant to import from "@jest/globals"',
              },
              {
                name: '@jest/globals',
                importNames: ['xdescribe', 'xit', 'xtest'],
                message: 'Do not commit disabled tests (disable this rule if needed)',
              },
            ],
          },
        ],
        'no-restricted-properties': [
          'error',
          {
            object: 'fs',
            property: 'promises',
            message: 'Import "fs/promises" directly instead. This allows methods to be mocked with Jest.',
          },
          {
            object: 'process',
            property: 'cwd',
            message: 'Pass the proper cwd through to avoid accidentally running operations in the wrong context.',
          },
          {
            object: 'process',
            property: 'chdir',
            message:
              'beachball should not be dependent on the actual process.cwd(). Ensure the proper cwd is passed through instead.',
          },
          {
            object: 'process',
            property: 'exit',
            message: 'Errors should be propagated to the top level and handled there.',
          },
        ],
        'no-restricted-syntax': [
          'error',
          {
            // copilot likes to write "as never" casts in tests
            selector: 'TSAsExpression > TSNeverKeyword',
            message: 'Cast to specific types and/or unknown instead',
          },
        ],

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
        'no-undef': 'off',
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
      files: ['*.js', '*.mjs'],
      languageOptions: {
        parserOptions: {
          sourceType: 'module',
        },
      },
      rules: {
        // Rule doesn't handle JS files
        '@typescript-eslint/explicit-module-boundary-types': 'off',
      },
    },
    {
      files: [`${src}/**/*.test.ts`],
      rules: {
        '@typescript-eslint/no-non-null-assertion': 'off',
      },
    },
    {
      files: [`${src}/__*/**/*`],
      rules: {
        '@typescript-eslint/no-empty-function': 'off',
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
      rules: {
        '@ms-cloudpack/no-deprecated': 'off',
      },
    },
    ...configs
  );
}
