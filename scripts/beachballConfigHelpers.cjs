const fs = require('fs');
const path = require('path');

const actionPrefix = '@microsoft/beachball-action-';
const skillName = '@microsoft/beachball-change-file-skill';
const yarnPluginPrefix = '@microsoft/beachball-yarn-plugin-';
const renovateName = '@microsoft/m365-renovate-config';
const normalPackages = ['beachball', 'proper-changelog', 'p-graph', '@microsoft/esrp-npm-release'];

/**
 * Matches the `getGitTag` signature from `BeachballOptions`, but can't reference it directly.
 * @param {{ name: string; version: string }} pkg
 * @param {string} defaultTag
 * @returns {string | string[] | null}
 */
function getGitTag({ name, version }, defaultTag) {
  if (name === skillName) {
    return `skill_v${version}`;
  }
  if (name.startsWith(actionPrefix)) {
    const { exactTag, majorTag } = getActionTags(name, version);
    return [exactTag, majorTag];
  }
  if (name.startsWith(yarnPluginPrefix)) {
    return getYarnPluginTag(name, version);
  }
  if (normalPackages.includes(name)) {
    return defaultTag;
  }
  if (name === renovateName) {
    // The renovate presets do NOT get tags since it would require a multi-step process of
    // updating all `extends` references and creating tags in a separate branch
    // https://github.com/microsoft/m365-renovate-config/blob/main/scripts/release/bumpAndRelease.ts#L125
    return null;
  }
  throw new Error(`Unhandled package "${name}" in custom getGitTag`);
}

/**
 * Matches the `postbump` hook signature from `BeachballOptions`, but can't reference it directly.
 * @typedef {(packagePath: string, name: string, version: string) => void} PostbumpHook
 * @type {PostbumpHook}
 */
function postbumpHook(packagePath, name, version) {
  if (name === skillName) {
    updateSkillMd(packagePath, name, version);
  } else if (name.startsWith(actionPrefix)) {
    updateActionReadme(packagePath, name, version);
  } else if (name.startsWith(yarnPluginPrefix)) {
    updateYarnPluginReadme(packagePath, name, version);
  }
}

/** Update version in SKILL.md @type {PostbumpHook} */
function updateSkillMd(packagePath, name, version) {
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
}

/** Update action tag in README.md @type {PostbumpHook} */
function updateActionReadme(packagePath, name, version) {
  const { actionName, majorTag } = getActionTags(name, version);
  const actionRef = `microsoft/beachball/actions/${actionName}@`;
  const newRef = `${actionRef}${majorTag}`;
  const actionRegex = new RegExp(`${actionRef}${actionName}_v\\d+`, 'g');

  console.log(`Updating README.md for ${name} to use new tag ${majorTag}`);
  const readmePath = path.join(packagePath, 'README.md');
  const readmeContent = fs.readFileSync(readmePath, 'utf8').replace(actionRegex, newRef);
  fs.writeFileSync(readmePath, readmeContent);
}

/** Update yarn plugin tag in README.md @type {PostbumpHook} */
function updateYarnPluginReadme(packagePath, name, version) {
  const newTag = /** @type {string} */ (getGitTag({ name, version }, ''));
  const tagPrefix = newTag.split('_v')[0];
  const tagRegex = new RegExp(`${tagPrefix}_v[^/]+`, 'g');

  console.log(`Updating README.md for ${name} to use new tag ${newTag}`);
  const readmePath = path.join(packagePath, 'README.md');
  const readmeContent = fs.readFileSync(readmePath, 'utf8').replace(tagRegex, newTag);
  fs.writeFileSync(readmePath, readmeContent, 'utf8');
}

function getYarnPluginTag(/** @type {string} */ name, /** @type {string} */ version) {
  return `${name.replace('@microsoft/beachball-', '')}_v${version}`;
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

module.exports = { getGitTag, getActionTags, postbumpHook, normalPackages };
