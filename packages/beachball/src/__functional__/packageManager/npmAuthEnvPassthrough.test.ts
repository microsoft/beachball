import fs from 'fs';
import path from 'path';
import { afterEach, describe, expect, it } from '@jest/globals';
import { checkNpmAuthEnvPassthrough, filterPathForNpm } from '../../packageManager/npmAuthEnvPassthrough';
import { BeachballError } from '../../types/BeachballError';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import { tmpdir, removeTempDir } from '../../__fixtures__/tmpdir';

describe('filterPathForNpm', () => {
  const makePathEnv = (...parts: string[]) => parts.join(path.delimiter);

  it('keeps a plain path unchanged', () => {
    const p = makePathEnv('/usr/local/bin', '/usr/bin', '/bin');
    expect(filterPathForNpm(p)).toEqual(p);
  });

  it('removes entries whose basename starts with yarn--', () => {
    const p = makePathEnv('/usr/local/bin', '/tmp/yarn--1234567890', '/usr/bin');
    expect(filterPathForNpm(p)).toEqual(makePathEnv('/usr/local/bin', '/usr/bin'));
  });

  it('removes entries whose basename starts with xfs-', () => {
    const p = makePathEnv('/usr/local/bin', '/tmp/xfs-abc123', '/usr/bin');
    expect(filterPathForNpm(p)).toEqual(makePathEnv('/usr/local/bin', '/usr/bin'));
  });

  it('removes multiple filtered entries', () => {
    const p = makePathEnv('/usr/local/bin', '/tmp/yarn--abc', '/tmp/xfs-xyz', '/usr/bin');
    expect(filterPathForNpm(p)).toEqual(makePathEnv('/usr/local/bin', '/usr/bin'));
  });

  it('keeps entries where yarn-- or xfs- appears in a parent segment but not the basename', () => {
    const p = makePathEnv('/home/user/yarn--stuff/tools', '/home/user/xfs-stuff/tools');
    expect(filterPathForNpm(p)).toEqual(p);
  });

  it('handles a single entry path', () => {
    expect(filterPathForNpm('/usr/local/bin')).toEqual('/usr/local/bin');
  });

  it('returns empty string for empty input', () => {
    expect(filterPathForNpm('')).toEqual('');
  });
});

describe('checkNpmAuthEnvPassthrough', () => {
  const logs = initMockLogs();
  const commonOptions = { path: process.cwd(), registry: 'https://registry.npmjs.org/' };

  let wrapperDir: string | undefined;

  afterEach(() => {
    wrapperDir && removeTempDir(wrapperDir);
    wrapperDir = undefined;
  });

  it('passes when the real node binary is on PATH', async () => {
    // process.execPath's directory is on PATH in the test environment
    await checkNpmAuthEnvPassthrough({ ...commonOptions });
    expect(logs.getMockLines('error')).toEqual('');
  });

  it('passes when PATH is given explicitly with node on it', async () => {
    const nodeBinDir = path.dirname(process.execPath);
    await checkNpmAuthEnvPassthrough({ ...commonOptions, pathEnv: nodeBinDir });
    expect(logs.getMockLines('error')).toEqual('');
  });

  // A shebang-based wrapper only works on POSIX
  // eslint-disable-next-line no-restricted-properties
  const itPosixLike = path.delimiter === ':' ? it : it.skip;
  itPosixLike('throws when node is wrapped by a script that drops special env vars', async () => {
    wrapperDir = tmpdir({ prefix: 'beachball-test-wrapper-' });
    const wrapperScript = path.join(wrapperDir, 'node');

    // Create a `node` wrapper script (using the real node binary in the shebang to avoid PATH lookup)
    // that mimics POSIX sh behavior of dropping invalid env var names.
    // We can't directly use `/bin/sh` because on some systems such as macOS, `sh` is actually `bash`.
    fs.writeFileSync(
      wrapperScript,
      [
        `#!${process.execPath}`,
        `const { spawnSync } = require('child_process');`,
        `const filteredEnv = Object.fromEntries(`,
        `  Object.entries(process.env).filter(([k]) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(k))`,
        `);`,
        `const r = spawnSync(process.execPath, process.argv.slice(2), { env: filteredEnv, stdio: 'inherit' });`,
        `process.exit(r.status ?? 1);`,
      ].join('\n'),
      { mode: 0o755 }
    );

    const pathWithWrapper = wrapperDir + path.delimiter + process.env.PATH!;

    await expect(checkNpmAuthEnvPassthrough({ ...commonOptions, pathEnv: pathWithWrapper })).rejects.toThrow(
      BeachballError
    );
    const errorLogs = logs.getMockLines('error');
    expect(errorLogs).toContain('The environment variable used to pass the npm auth token');
    expect(errorLogs).toContain(`Your PATH:\n${pathWithWrapper}`);
    expect(errorLogs).toContain('node bin/beachball.js <args>');
  });
});
