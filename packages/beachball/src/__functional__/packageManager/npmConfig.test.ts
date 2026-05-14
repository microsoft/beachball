import { afterEach, describe, expect, it } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import {
  getNpmConfig,
  clearNpmConfigCache,
  resolveNpmConfig,
  npmRegistryDefault,
} from '../../packageManager/npmConfig';
import { removeTempDir, tmpdir } from '../../__fixtures__/tmpdir';

describe('getNpmConfig', () => {
  let tempRoot: string;

  afterEach(() => {
    clearNpmConfigCache();
    removeTempDir(tempRoot);
  });

  it('returns default registry when no .npmrc exists', async () => {
    tempRoot = tmpdir();
    const result = await getNpmConfig(tempRoot);
    expect(result.registry).toBe(npmRegistryDefault);
  });

  it('reads registry from project-level .npmrc', async () => {
    tempRoot = tmpdir();
    fs.writeFileSync(path.join(tempRoot, '.npmrc'), 'registry=https://my-registry.example.com/\n');
    const result = await getNpmConfig(tempRoot);
    expect(result.registry).toBe('https://my-registry.example.com/');
  });

  it('substitutes ${VAR} environment variables in registry value', async () => {
    tempRoot = tmpdir();
    fs.writeFileSync(path.join(tempRoot, '.npmrc'), 'registry=https://${TEST_REGISTRY_HOST}/npm/\n');
    const origVal = process.env.TEST_REGISTRY_HOST;
    process.env.TEST_REGISTRY_HOST = 'my-private-host.example.com';
    try {
      const result = await getNpmConfig(tempRoot);
      expect(result.registry).toBe('https://my-private-host.example.com/npm/');
    } finally {
      if (origVal === undefined) {
        delete process.env.TEST_REGISTRY_HOST;
      } else {
        process.env.TEST_REGISTRY_HOST = origVal;
      }
    }
  });

  it('reads auth token from .npmrc for the configured registry', async () => {
    tempRoot = tmpdir();
    const registryUrl = 'https://my-registry.example.com/';
    fs.writeFileSync(
      path.join(tempRoot, '.npmrc'),
      [`registry=${registryUrl}`, `//my-registry.example.com/:_authToken=my-secret-token`].join('\n') + '\n'
    );
    const result = await getNpmConfig(tempRoot);
    expect(result.registry).toBe(registryUrl);
    expect(result.credentials.token).toBe('my-secret-token');
  });

  it('returns empty credentials when no auth is configured', async () => {
    tempRoot = tmpdir();
    fs.writeFileSync(path.join(tempRoot, '.npmrc'), 'registry=https://my-registry.example.com/\n');
    const result = await getNpmConfig(tempRoot);
    expect(result.credentials.token).toBeUndefined();
  });

  it('caches results per cwd', async () => {
    tempRoot = tmpdir();
    fs.writeFileSync(path.join(tempRoot, '.npmrc'), 'registry=https://cached-registry.example.com/\n');

    const result1 = await getNpmConfig(tempRoot);
    // Overwrite the file — cached result should be returned
    fs.writeFileSync(path.join(tempRoot, '.npmrc'), 'registry=https://new-registry.example.com/\n');
    const result2 = await getNpmConfig(tempRoot);

    expect(result1).toBe(result2); // same object reference
    expect(result2.registry).toBe('https://cached-registry.example.com/');
  });
});

describe('resolveNpmConfig', () => {
  let tempRoot: string;

  afterEach(() => {
    clearNpmConfigCache();
    removeTempDir(tempRoot);
  });

  it('sets registry from .npmrc when not already set', async () => {
    tempRoot = tmpdir();
    fs.writeFileSync(path.join(tempRoot, '.npmrc'), 'registry=https://npmrc-registry.example.com/\n');

    const options: { path: string; registry?: string; token?: string } = { path: tempRoot };
    const resolved = await resolveNpmConfig(options);

    expect(resolved.registry).toBe('https://npmrc-registry.example.com/');
  });

  it('does not override explicit registry', async () => {
    tempRoot = tmpdir();
    fs.writeFileSync(path.join(tempRoot, '.npmrc'), 'registry=https://npmrc-registry.example.com/\n');

    const options = { path: tempRoot, registry: 'https://explicit-registry.example.com/' };
    const resolved = await resolveNpmConfig(options);

    expect(resolved.registry).toBe('https://explicit-registry.example.com/');
  });

  it('sets token from .npmrc when not already set', async () => {
    tempRoot = tmpdir();
    fs.writeFileSync(
      path.join(tempRoot, '.npmrc'),
      ['registry=https://my-registry.example.com/', '//my-registry.example.com/:_authToken=npmrc-token'].join('\n') +
        '\n'
    );

    const options: { path: string; registry?: string; token?: string } = { path: tempRoot };
    const resolved = await resolveNpmConfig(options);

    expect(resolved.token).toBe('npmrc-token');
  });

  it('does not override explicit token', async () => {
    tempRoot = tmpdir();
    fs.writeFileSync(
      path.join(tempRoot, '.npmrc'),
      ['registry=https://my-registry.example.com/', '//my-registry.example.com/:_authToken=npmrc-token'].join('\n') +
        '\n'
    );

    const options = { path: tempRoot, token: 'cli-token' };
    const resolved = await resolveNpmConfig(options);

    expect(resolved.token).toBe('cli-token');
  });

  it('returns options with registry guaranteed as string', async () => {
    tempRoot = tmpdir();
    const options: { path: string; registry?: string } = { path: tempRoot };
    const resolved = await resolveNpmConfig(options);

    // TypeScript type narrowing: registry should be string
    const registryVal: string = resolved.registry;
    expect(typeof registryVal).toBe('string');
  });
});
