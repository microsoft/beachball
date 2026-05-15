const fs = require('fs');
const path = require('path');

const actionPrefix = '@microsoft/beachball-action-';

/**
 * Matches the `getGitTag` signature from `BeachballOptions`, but can't reference it directly.
 * @param {{ name: string; version: string }} pkg
 * @param {string} defaultTag
 */
function getGitTag(pkg, defaultTag) {
  if (!pkg.name.startsWith(actionPrefix)) {
    return defaultTag;
  }
  const { exactTag, majorTag } = getActionTags(pkg.name, pkg.version);
  return [exactTag, majorTag];
}

/**
 * Matches the `postbump` hook signature from `BeachballOptions`, but can't reference it directly.
 * @param {string} packagePath
 * @param {string} name
 * @param {string} version
 */
function postbumpHook(packagePath, name, version) {
  if (!name.startsWith(actionPrefix)) return;

  const { actionName, majorTag } = getActionTags(name, version);
  console.log(`Updating README.md for ${name} to use new tag ${majorTag}`);
  const readmePath = path.join(packagePath, 'README.md');
  const actionRef = `microsoft/beachball/actions/${actionName}@`;
  const readmeContent = fs
    .readFileSync(readmePath, 'utf8')
    .replace(new RegExp(`${actionRef}${actionName}_v\\d+`, 'g'), `${actionRef}${majorTag}`);
  fs.writeFileSync(readmePath, readmeContent);
}

/**
 * @param {string} name
 * @param {string} version
 * @returns example: `{ actionName: 'should-release', exactTag: 'should-release_v1.2.3', majorTag: 'should-release_v1' }`
 */
function getActionTags(name, version) {
  const actionName = name.replace(actionPrefix, '');
  return {
    actionName,
    exactTag: `${actionName}_v${version}`,
    majorTag: `${actionName}_v${version.split('.')[0]}`,
  };
}

module.exports = { getGitTag, getActionTags, postbumpHook };
