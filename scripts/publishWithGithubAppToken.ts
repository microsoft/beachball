#!/usr/bin/env node

//
// This script sets credentials from the given GITHUB_APP_TOKEN, then runs publish commands.
// It's meant to be run in ADO pipelines only.
//

import { spawnSync } from 'child_process';
import path from 'path';
import { findGitRoot, git, type GitProcessOutput } from 'workspace-tools';

const repoRoot = findGitRoot(process.cwd());

const token = process.env.GITHUB_APP_TOKEN;
const gitUserEmail = '257645319+office-ogx-auth-helper[bot]@users.noreply.github.com';
const gitUserName = 'OGX bot';
const ghaTokenCli = path.join(repoRoot, 'scripts/create-github-app-token.cjs');
const repositoryUri = process.env.BUILD_REPOSITORY_URI;

if (!token) {
  adoFail('GITHUB_APP_TOKEN is not set');
} else if (!token.startsWith('ghs_')) {
  adoFail(`GITHUB_APP_TOKEN is not in the expected format (ghs_...); starts with '${token.slice(0, 4)}'`);
} else if (!repositoryUri) {
  adoFail('BUILD_REPOSITORY_URI is not set');
}

/**
 * Run a git command against the repo, logging it first.
 * @param logArgs - args to log instead of `args` (used to redact secret values)
 */
function runGit(args: string[], options?: { throwOnError?: boolean; logArgs?: string[] }): GitProcessOutput {
  console.log(`git ${(options?.logArgs ?? args).join(' ')}`);
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

// Encode the auth header value to be used below.
const authHeader = Buffer.from(`x-access-token:${token}`).toString('base64');

// Mark secrets to be masked in logs.
console.log(`##vso[task.setsecret]${authHeader}`);

// Read any existing extraheader config values before setting our own, so they can be restored on
// exit. (The checkout step in 1ES templates ignores persistCredentials: false...)
// With `-z`, entries are NUL-separated and each entry is "key\nvalue".
const savedExtraheaders: { key: string; value: string }[] = [];
const existing = runGit(['config', '-z', '--get-regexp', '\\.extraheader$']);
if (existing.success && existing.stdout) {
  for (const entry of existing.stdout.split('\0')) {
    const [key, value = ''] = entry.split('\n', 2);
    key && savedExtraheaders.push({ key, value });
  }
}

// The unique keys to clear before setting ours (a key may hold multiple values).
const extraheaderKeys = [...new Set(savedExtraheaders.map(entry => entry.key))];

// On exit: remove our temporary header and restore originals, and revoke the token.
// All operations here are synchronous so they complete within the 'exit' handler.
let cleanedUp = false;
process.on('exit', () => {
  if (cleanedUp) return;
  cleanedUp = true;

  runGit(['config', '--unset-all', `http.${repositoryUri}.extraheader`]);
  for (const key of extraheaderKeys) {
    runGit(['config', '--unset-all', key]);
  }
  for (const { key, value } of savedExtraheaders) {
    // Redact the value: original extraheaders may contain the checkout token.
    runGit(['config', '--add', key, value], { logArgs: ['config', '--add', key, '...'] });
  }

  if (token) {
    const revoke = spawnSync('node', [ghaTokenCli], {
      cwd: repoRoot,
      stdio: 'inherit',
      env: { ...process.env, REVOKE_TOKEN: token },
    });
    if (revoke.status !== 0) {
      adoWarn('revoking github app token failed (will automatically expire in < 1hr)');
    }
  }
});

// Clear the saved extraheaders, then set our own so it's the only one on the wire.
for (const key of extraheaderKeys) {
  runGit(['config', '--unset-all', key]);
}
runGit(['config', `http.${repositoryUri}.extraheader`, `AUTHORIZATION: basic ${authHeader}`], {
  throwOnError: true,
  logArgs: ['config', `http.${repositoryUri}.extraheader`, '...'],
});

const args = ['beachball:release', 'publish', '--no-publish'];
console.log(`yarn ${args.join(' ')}`);
const publish = spawnSync('yarn', args, {
  cwd: repoRoot,
  stdio: 'inherit',
  // Needed on Windows to resolve the `yarn` shim; args are static and trusted.
  shell: true,
});
if (publish.status !== 0) {
  process.exit(publish.status ?? 1);
}
