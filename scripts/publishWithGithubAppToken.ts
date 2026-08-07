#!/usr/bin/env node

//
// This script configures the git identity, runs `beachball publish --no-publish` with BEACHBALL_GIT_TOKEN,
// and revokes the token on exit. It's meant to be run in ADO pipelines only.
//

import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { findGitRoot, git, type GitProcessOutput } from 'workspace-tools';

const repoRoot = findGitRoot(process.cwd());

const token = process.env.BEACHBALL_GIT_TOKEN;
const gitUserEmail = '257645319+office-ogx-auth-helper[bot]@users.noreply.github.com';
const gitUserName = 'OGX bot';
const ghaTokenCli = path.join(repoRoot, 'packages/beachball/dist/github-app-token.mjs');
if (!fs.existsSync(ghaTokenCli)) {
  adoFail(`GitHub App token CLI not found at ${ghaTokenCli}`);
}
if (!token) {
  adoFail('BEACHBALL_GIT_TOKEN is not set');
} else if (!token.startsWith('ghs_')) {
  adoFail(`BEACHBALL_GIT_TOKEN is not in the expected format (ghs_...); starts with '${token.slice(0, 4)}'`);
}

/** Run a git command against the repo, logging it first. */
function runGit(args: string[], options?: { throwOnError?: boolean }): GitProcessOutput {
  console.log(`git ${args.join(' ')}`);
  return git(args, { cwd: repoRoot, throwOnError: options?.throwOnError });
}

/** Log an ADO pipeline error and exit with a non-zero code. */
function adoFail(message: string): never {
  console.log(`##vso[task.logissue type=error]${message}`);
  process.exit(1);
}

function adoWarn(message: string): void {
  console.log(`##vso[task.logissue type=warning]${message}`);
}

// Configure the git author identity.
runGit(['config', 'user.email', gitUserEmail], { throwOnError: true });
runGit(['config', 'user.name', gitUserName], { throwOnError: true });

// On exit, revoke the token. (Synchronous so it completes within the 'exit' handler.)
let cleanedUp = false;
process.on('exit', () => {
  if (cleanedUp) return;
  cleanedUp = true;

  const revoke = spawnSync('node', [ghaTokenCli, 'revoke'], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: { ...process.env, TOKEN: token },
  });
  if (revoke.status !== 0) {
    adoWarn('revoking github app token failed (will automatically expire in < 1hr)');
  }
});

// Run publish. Beachball reads `BEACHBALL_GIT_TOKEN` to authenticate the git push.
const args = ['beachball:release', 'publish', '--no-publish'];
console.log(`yarn ${args.join(' ')}`);
const publish = spawnSync('yarn', args, {
  cwd: repoRoot,
  stdio: 'inherit',
  shell: true, // needed for yarn on windows
  env: { ...process.env, BEACHBALL_GIT_TOKEN: token },
});
if (publish.status !== 0) {
  process.exit(publish.status ?? 1);
}
