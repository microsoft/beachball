// @ts-check
const path = require('path');

/** @type {import('@typescript-eslint/utils').TSESLint.Linter.Config} */
const config = {
  extends: require.resolve('@microsoft/beachball-scripts/config/eslintrc.base'),
  root: true,
  parserOptions: {
    project: [path.join(__dirname, 'tsconfig.json')],
  },
};

module.exports = config;
