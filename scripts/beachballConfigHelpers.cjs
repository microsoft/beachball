const fs = require('fs');
const path = require('path');

const actionPrefix = '@microsoft/beachball-action-';
const skillName = '@microsoft/beachball-change-file-skill';

/**
 * Matches the `getGitTag` signature from `BeachballOptions`, but can't reference it directly.
 * @param {{ name: string; version: string }} pkg
 * @param {string} defaultTag
 */
function getGitTag(pkg, defaultTag) {
  if (pkg.name === skillName) {
    return `skill_v${pkg.version}`;
  }
  if (pkg.name.startsWith(actionPrefix)) {
    const { exactTag, majorTag } = getActionTags(pkg.name, pkg.version);
    return [exactTag, majorTag];
  }
  return defaultTag;
}

/**
 * Matches the `postbump` hook signature from `BeachballOptions`, but can't reference it directly.
 * @param {string} packagePath
 * @param {string} name
 * @param {string} version
 */
function postbumpHook(packagePath, name, version) {
  if (name === skillName) {
    // Update version in SKILL.md
    const skillMdPath = path.join(packagePath, 'beachball-change-file/SKILL.md');
    console.log(`Updating ${skillMdPath} to version ${version}`);
    const content = fs.readFileSync(skillMdPath, 'utf8');
    const frontmatterMatch = content.match(/^---\r?\n[\s\S]*?\r?\n---/);
    if (!frontmatterMatch) {
      throw new Error(`Could not find frontmatter in ${skillMdPath}`);
    }
    const versionRegexp = /^(\s+version:\s*)(.*)/m;
    if (!versionRegexp.test(frontmatterMatch[0])) {
      throw new Error(`Could not find version field in frontmatter of ${skillMdPath}`);
    }
    const newFrontmatter = frontmatterMatch[0].replace(versionRegexp, `$1${version}`);
    const newContent = content.replace(frontmatterMatch[0], newFrontmatter);
    fs.writeFileSync(skillMdPath, newContent);
  } else if (name.startsWith(actionPrefix)) {
    // Update action tag in README.md
    const { actionName, majorTag } = getActionTags(name, version);
    console.log(`Updating README.md for ${name} to use new tag ${majorTag}`);
    const readmePath = path.join(packagePath, 'README.md');
    const actionRef = `microsoft/beachball/actions/${actionName}@`;
    const readmeContent = fs
      .readFileSync(readmePath, 'utf8')
      .replace(new RegExp(`${actionRef}${actionName}_v\\d+`, 'g'), `${actionRef}${majorTag}`);
    fs.writeFileSync(readmePath, readmeContent);
  }
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
