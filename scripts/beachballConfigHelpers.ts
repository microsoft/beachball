import fs from 'fs';
import path from 'path';

const actionPrefix = '@microsoft/beachball-action-';
const skillName = '@microsoft/beachball-change-file-skill';
const yarnPluginPrefix = '@microsoft/beachball-yarn-plugin-';
const renovateName = '@microsoft/m365-renovate-config';
export const normalPackages = ['beachball', 'proper-changelog', 'p-graph', '@microsoft/esrp-npm-release'];

/**
 * Matches the `getGitTag` signature from `BeachballOptions`, but can't reference it directly.
 */
export function getGitTag(pkg: { name: string; version: string }, defaultTag: string): string | string[] | null {
  const { name, version } = pkg;
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
    // For renovate presets, the tags ONLY work for presets that don't extend others from this repo.
    // Making self-references work would require a multi-step process of updating all `extends`
    // references and creating tags in a separate branch, which likely isn't necessary, but could
    // be re-implemented based on this logic if needed:
    // https://github.com/microsoft/m365-renovate-config/blob/main/scripts/release/bumpAndRelease.ts#L125
    const { exactTag, majorTag } = getExactAndMajorTags(name, version);
    return [exactTag, majorTag];
  }
  throw new Error(`Unhandled package "${name}" in custom getGitTag`);
}

/**
 * Matches the `postbump` hook signature from `BeachballOptions`, but can't reference it directly.
 */
type PostbumpHook = (packagePath: string, name: string, version: string) => void;

export const postbumpHook: PostbumpHook = (packagePath, name, version) => {
  if (name === skillName) {
    updateSkillMd(packagePath, name, version);
  } else if (name.startsWith(actionPrefix)) {
    updateActionReadme(packagePath, name, version);
  } else if (name.startsWith(yarnPluginPrefix)) {
    updateYarnPluginReadme(packagePath, name, version);
  }
};

/** Update version in SKILL.md */
const updateSkillMd: PostbumpHook = (packagePath, name, version) => {
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
};

/** Update action tag in README.md */
const updateActionReadme: PostbumpHook = (packagePath, name, version) => {
  const { actionName, majorTag } = getActionTags(name, version);
  const actionRef = `microsoft/beachball/actions/${actionName}@`;
  const newRef = `${actionRef}${majorTag}`;
  const actionRegex = new RegExp(`${actionRef}${actionName}_v\\d+`, 'g');

  console.log(`Updating README.md for ${name} to use new tag ${majorTag}`);
  const readmePath = path.join(packagePath, 'README.md');
  const readmeContent = fs.readFileSync(readmePath, 'utf8').replace(actionRegex, newRef);
  fs.writeFileSync(readmePath, readmeContent);
};

/** Update yarn plugin tag in README.md */
const updateYarnPluginReadme: PostbumpHook = (packagePath, name, version) => {
  const newTag = getYarnPluginTag(name, version);
  const tagPrefix = newTag.split('_v')[0];
  const tagRegex = new RegExp(`${tagPrefix}_v[^/]+`, 'g');

  console.log(`Updating README.md for ${name} to use new tag ${newTag}`);
  const readmePath = path.join(packagePath, 'README.md');
  const readmeContent = fs.readFileSync(readmePath, 'utf8').replace(tagRegex, newTag);
  fs.writeFileSync(readmePath, readmeContent, 'utf8');
};

function getYarnPluginTag(name: string, version: string): string {
  return `${name.replace('@microsoft/beachball-', '')}_v${version}`;
}

/** Get tags like `foo_v1.2.3` and `foo_v1` */
function getExactAndMajorTags(name: string, version: string) {
  return {
    exactTag: `${name}_v${version}`,
    majorTag: `${name}_v${version.split('.')[0]}`,
  };
}

/**
 * @returns example: `{ actionName: 'should-release', exactTag: 'should-release_v1.2.3', majorTag: 'should-release_v1' }`
 */
export function getActionTags(name: string, version: string) {
  const actionName = name.replace(actionPrefix, '');
  return { actionName, ...getExactAndMajorTags(actionName, version) };
}
