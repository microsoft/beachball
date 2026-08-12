export default {
  // For packages with bundled output, automatically bundle when src changes are staged
  ...Object.fromEntries(
    ['actions/should-release', 'yarn-plugins/engines', 'yarn-plugins/npmrc'].map(dir => [
      `${dir}/src/**`,
      [`yarn --cwd ${dir} bundle`, `git add ${dir}/dist`],
    ])
  ),
  // Applies to all files and shouldn't conflict
  '*': ['prettier --write'],
};
