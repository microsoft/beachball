// @ts-check
'use strict';

const fs = require('fs');
const path = require('path');
const { getChangesBetweenRefs, getDefaultRemoteBranch, git } = require('workspace-tools');
const beachballConfig = require('../beachball.config');

const targetBranch = getDefaultRemoteBranch({
  branch: beachballConfig.branch || 'main',
  cwd: process.cwd(),
});
const repoRoot = path.resolve(__dirname, '..');
const marketplacePath = path.join(repoRoot, '.claude-plugin', 'marketplace.json');

/** @type {string[]} */
const errors = [];

function error(/** @type {string} */ msg) {
  errors.push(msg);
  console.error(`  ERROR: ${msg}`);
}

/**
 * Extract a field from YAML frontmatter by regex.
 * @param {string} content
 * @param {RegExp} pattern - Must have one capture group for the value
 * @returns {string | undefined}
 */
function matchFrontmatter(content, pattern) {
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch) return undefined;
  const lineMatch = fmMatch[1].match(pattern);
  return lineMatch ? lineMatch[1].trim() : undefined;
}

/**
 * Get a file's content from a specific git ref.
 * @param {string} filePath - Absolute path to a file (symlinks are resolved)
 * @param {string} ref
 * @returns {string | undefined}
 */
function getFileAtRef(filePath, ref) {
  const realPath = fs.realpathSync(filePath);
  const relPath = path.relative(repoRoot, realPath);
  const result = git(['show', `${ref}:${relPath}`], { cwd: repoRoot });
  return result.success ? result.stdout : undefined;
}

// --- Load marketplace ---
if (!fs.existsSync(marketplacePath)) {
  console.error('marketplace.json not found at', marketplacePath);
  process.exit(1);
}

const marketplace = JSON.parse(fs.readFileSync(marketplacePath, 'utf8'));

console.log(`Validating Claude marketplace "${marketplace.name}" (${marketplace.plugins.length} plugin(s))\n`);

for (const entry of marketplace.plugins) {
  console.log(`Plugin: ${entry.name}`);

  // --- Resolve plugin source directory ---
  const sourceDir = path.resolve(path.dirname(marketplacePath), entry.source);
  if (!fs.existsSync(sourceDir)) {
    error(`Marketplace source directory not found: ${entry.source}`);
    continue;
  }

  // --- Check directory name matches plugin name ---
  const dirName = path.basename(sourceDir);
  if (dirName !== entry.name) {
    error(`Directory name "${dirName}" does not match marketplace plugin name "${entry.name}"`);
  }

  // --- Load plugin.json ---
  const pluginJsonPath = path.join(sourceDir, 'plugin.json');
  if (!fs.existsSync(pluginJsonPath)) {
    error(`plugin.json not found at ${path.relative(repoRoot, pluginJsonPath)}`);
    continue;
  }

  const plugin = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf8'));

  // --- Name sync: marketplace ↔ plugin.json ---
  if (entry.name !== plugin.name) {
    error(`Name mismatch: marketplace has "${entry.name}", plugin.json has "${plugin.name}"`);
  }

  // --- Version sync: marketplace ↔ plugin.json ---
  if (entry.version !== plugin.version) {
    error(
      `Version mismatch between marketplace (${entry.version}) and plugin.json (${plugin.version}) for "${entry.name}"`
    );
  }

  // --- Validate skill paths and version sync ---
  const skills = (plugin.components && plugin.components.skills) || [];
  for (const skill of skills) {
    const skillAbsPath = path.resolve(sourceDir, skill.path);
    const skillRelPath = path.relative(repoRoot, skillAbsPath);

    if (!fs.existsSync(skillAbsPath)) {
      error(`Skill path does not resolve to a file: ${skill.path} (resolved to ${skillRelPath})`);
      continue;
    }

    console.log(`  Skill: ${skill.name} -> ${skillRelPath}`);

    // --- Parse frontmatter and check version ---
    const skillContent = fs.readFileSync(skillAbsPath, 'utf8');
    const skillVersion = matchFrontmatter(skillContent, /^\s+version:\s*(.*)/m);

    if (!skillVersion) {
      error(`SKILL.md is missing metadata.version in frontmatter (${skillRelPath})`);
    } else if (skillVersion !== plugin.version) {
      error(
        `Version mismatch: plugin.json has "${plugin.version}" but SKILL.md metadata.version is "${skillVersion}" (${skillRelPath})`
      );
    }

    // --- Check that skill content changes are accompanied by a version bump ---
    // (current approach will miss local changes if not committed yet, but works in PR)
    const skillChanges = getChangesBetweenRefs({
      fromRef: targetBranch,
      cwd: repoRoot,
      pattern: skillRelPath,
    });
    if (skillChanges.length) {
      const baseContent = getFileAtRef(skillAbsPath, targetBranch);
      const baseVersion = baseContent ? matchFrontmatter(baseContent, /^\s+version:\s*(.*)/m) : undefined;
      if (baseVersion && skillVersion && baseVersion === skillVersion) {
        error(
          `SKILL.md has changed since ${targetBranch} but metadata.version was not bumped (still ${baseVersion}) (${skillRelPath})`
        );
      }
    }

    // --- Check skill name matches between plugin.json and SKILL.md ---
    const skillName = matchFrontmatter(skillContent, /^name:\s*(.*)/m);
    if (skillName && skillName !== skill.name) {
      error(
        `Skill name mismatch: plugin.json has "${skill.name}" but SKILL.md frontmatter has "${skillName}" (${skillRelPath})`
      );
    }
  }

  console.log();
}

if (errors.length > 0) {
  console.error(`\nFound ${errors.length} error(s)`);
  process.exit(1);
} else {
  console.log('All Claude marketplace and plugin checks passed.');
}
