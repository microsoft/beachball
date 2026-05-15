// @ts-check

const fs = require('fs');
const path = require('path');

/** @type {Partial<import('./packages/beachball/src/types/BeachballOptions').RepoOptions>}*/
const config = {
  access: 'public',
  branch: 'main',
  commit: false,
  ignorePatterns: ['.*ignore', '.eslintrc.js', 'eslint.config.*', 'jest.*.js', 'src/__*/**'],

  // TODO (release): re-enable -- it has to be disabled while releasing actions separately
  groupChanges: false,
  // TODO (release): change back to major
  disallowedChangeTypes: ['prerelease'],
  // TODO (release): remove
  canaryName: 'alpha',

  // TODO (release): remove beachball exclusion (but still don't tag the actions common package)
  getGitTag: (pkg, _defaultTag) => {
    if (!pkg.name.startsWith(actionPrefix)) return null;
    const { exactTag, majorTag } = getActionTags(pkg.name, pkg.version);
    return [exactTag, majorTag];
  },

  hooks: {
    postbump: (packagePath, name, version) => {
      if (!name.startsWith(actionPrefix)) return;

      const { tagPrefix, majorTag } = getActionTags(name, version);
      console.log(`Updating README.md for ${name} to use new tag ${majorTag}`);
      const anyMajorTagPrefix = tagPrefix.replace(/\d+$/, '');
      const readmePath = path.join(packagePath, 'README.md');
      const readmeContent = fs
        .readFileSync(readmePath, 'utf8')
        .replace(new RegExp(`(${anyMajorTagPrefix}\\d+)`, 'g'), majorTag);
      fs.writeFileSync(readmePath, readmeContent);
    },
  },
};

const actionPrefix = '@microsoft/beachball-action-';

/**
 * For actions, create tags: `["should-release_v1.2.3", "should-release_v1"]`
 * @param {string} name
 * @param {string} version
 */
function getActionTags(name, version) {
  const tagPrefix = name.replace(actionPrefix, '');
  return {
    tagPrefix,
    exactTag: `${tagPrefix}_v${version}`,
    majorTag: `${tagPrefix}_v${version.split('.')[0]}`,
  };
}

module.exports = config;
