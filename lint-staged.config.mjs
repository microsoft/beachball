export default {
  // For packages with bundled output, automatically bundle when src changes are staged
  ...Object.fromEntries(
    ['actions/should-release', 'yarn-plugins/engines', 'yarn-plugins/npmrc'].map(dir => [
      `${dir}/src/**`,
      [`yarn --cwd ${dir} bundle`, `git add ${dir}/dist`],
    ])
  ),
  // This applies to all files and does not conflict with the bundle command above
  // (the bundled dist files aren't formatted, and formatting shouldn't change output)
  '*': ['prettier --write'],
};
