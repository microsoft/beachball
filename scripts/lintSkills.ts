import fs from 'fs';
import { createRequire } from 'module';
import path from 'path';
import { getChangesBetweenRefs, getDefaultRemoteBranch, git } from 'workspace-tools';

// load beachball config with require for now to avoid TS checking of CJS code from beachball
const localRequire = createRequire(import.meta.url);
const beachballConfig = localRequire('../beachball.config.js') as { branch?: string };

const targetBranch = getDefaultRemoteBranch({
  branch: beachballConfig.branch || 'main',
  cwd: process.cwd(),
});
const repoRoot = path.resolve(import.meta.dirname, '..');
const skillsDir = path.join(repoRoot, 'skills');

const errors: string[] = [];

function error(msg: string): void {
  errors.push(msg);
  console.error(`  ERROR: ${msg}`);
}

/**
 * Extract a field from YAML frontmatter by regex.
 */
function matchFrontmatter(content: string, pattern: RegExp): string | undefined {
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch) return undefined;
  const lineMatch = fmMatch[1].match(pattern);
  return lineMatch ? lineMatch[1].trim() : undefined;
}

/**
 * Get a file's content from a specific git ref.
 */
function getFileAtRef(filePath: string, ref: string): string | undefined {
  const relPath = path.relative(repoRoot, filePath);
  const result = git(['show', `${ref}:${relPath}`], { cwd: repoRoot });
  return result.success ? result.stdout : undefined;
}

// --- Validate skills directory ---
if (!fs.existsSync(skillsDir)) {
  console.error('Skills directory not found at', skillsDir);
  process.exit(1);
}

const skillDirs = fs
  .readdirSync(skillsDir, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name);

console.log(`Validating Agent Skills (${skillDirs.length} skill(s))\n`);

for (const dirName of skillDirs) {
  const skillDir = path.join(skillsDir, dirName);
  const skillPath = path.join(skillDir, 'SKILL.md');
  const skillRelPath = path.relative(repoRoot, skillPath);

  console.log(`Skill: ${dirName}`);

  // --- Check SKILL.md exists ---
  if (!fs.existsSync(skillPath)) {
    error(`SKILL.md not found at ${skillRelPath}`);
    continue;
  }

  const content = fs.readFileSync(skillPath, 'utf8');

  // --- Check frontmatter exists ---
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch) {
    error(`Missing YAML frontmatter (${skillRelPath})`);
    continue;
  }

  // --- Validate name field ---
  const name = matchFrontmatter(content, /^name:\s*(.*)/m);
  if (!name) {
    error(`Missing "name" in frontmatter (${skillRelPath})`);
  } else {
    if (name !== dirName) {
      error(`Frontmatter name "${name}" does not match directory name "${dirName}" (${skillRelPath})`);
    }
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(name) || name.includes('--')) {
      error(`Name "${name}" does not match Agent Skills spec (lowercase alphanumeric and hyphens) (${skillRelPath})`);
    }
    if (name.length > 64) {
      error(`Name "${name}" exceeds 64 character limit (${skillRelPath})`);
    }
  }

  // --- Validate description field ---
  const description = matchFrontmatter(content, /^description:\s*(.*)/m);
  if (!description) {
    error(`Missing "description" in frontmatter (${skillRelPath})`);
  } else if (description.length > 1024) {
    error(`Description exceeds 1024 character limit (${skillRelPath})`);
  }

  // --- Check version in metadata ---
  const version = matchFrontmatter(content, /^\s+version:\s*(.*)/m);
  if (!version) {
    error(`Missing metadata.version in frontmatter (${skillRelPath})`);
  }

  // --- Check that skill content changes are accompanied by a version bump ---
  const skillChanges = getChangesBetweenRefs({
    fromRef: targetBranch,
    cwd: repoRoot,
    pattern: skillRelPath,
  });
  if (skillChanges.length && version) {
    const baseContent = getFileAtRef(skillPath, targetBranch);
    const baseVersion = baseContent ? matchFrontmatter(baseContent, /^\s+version:\s*(.*)/m) : undefined;
    if (baseVersion && baseVersion === version) {
      error(
        `SKILL.md has changed since ${targetBranch} but metadata.version was not bumped (still ${baseVersion}) (${skillRelPath})`
      );
    }
  }

  // --- Check skill has content after frontmatter ---
  const body = content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').trim();
  if (!body) {
    error(`Skill has no content after frontmatter (${skillRelPath})`);
  }

  console.log();
}

if (errors.length > 0) {
  console.error(`Found ${errors.length} error(s)`);
  process.exit(1);
} else {
  console.log('All Agent Skills checks passed.');
}
