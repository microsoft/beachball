#!/usr/bin/env node

//
// This script configures the git identity, runs `beachball publish --no-publish` with BEACHBALL_GIT_TOKEN,
// and revokes the token on exit. It's meant to be run in ADO pipelines only.
//

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { findGitRoot } from 'workspace-tools';

const repoRoot = findGitRoot(process.cwd());

const ghaTokenCli = path.join(repoRoot, 'packages/beachball/dist/github-app-token.mjs');
if (!fs.existsSync(ghaTokenCli)) {
  adoFail(`GitHub App token CLI not found at ${ghaTokenCli}`);
}

const token = process.env.BEACHBALL_GIT_TOKEN;
if (!token) {
  adoFail('BEACHBALL_GIT_TOKEN is not set');
} else if (!token.startsWith('ghs_')) {
  adoFail(`BEACHBALL_GIT_TOKEN is not in the expected format (ghs_...); starts with '${token.slice(0, 4)}'`);
}

/** Log an ADO pipeline error and exit with a non-zero code. */
function adoFail(message: string): never {
  console.log(`##vso[task.logissue type=error]${message}`);
  process.exit(1);
}

function adoWarn(message: string): void {
  console.log(`##vso[task.logissue type=warning]${message}`);
}

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
});
process.exitCode = publish.status ?? 1;
