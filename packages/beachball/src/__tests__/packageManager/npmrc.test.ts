import { describe, expect, it, afterAll } from '@jest/globals';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { getRegistryFromNpmrc } from '../../packageManager/npmrc';

describe('getRegistryFromNpmrc', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beachball-npmrc-test-'));

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns undefined when no .npmrc exists', () => {
    const subDir = path.join(tmpDir, 'no-npmrc');
    fs.mkdirSync(subDir, { recursive: true });
    // Use a custom homedir to avoid picking up the user's ~/.npmrc
    const origHome = process.env.HOME;
    process.env.HOME = subDir;
    try {
      const result = getRegistryFromNpmrc(subDir);
      expect(result).toBeUndefined();
    } finally {
      process.env.HOME = origHome;
    }
  });

  it('reads registry from project-level .npmrc', () => {
    const subDir = path.join(tmpDir, 'project-npmrc');
    fs.mkdirSync(subDir, { recursive: true });
    fs.writeFileSync(path.join(subDir, '.npmrc'), 'registry=https://my-registry.example.com/\n');
    expect(getRegistryFromNpmrc(subDir)).toBe('https://my-registry.example.com/');
  });

  it('handles registry with spaces around equals sign', () => {
    const subDir = path.join(tmpDir, 'spaced-npmrc');
    fs.mkdirSync(subDir, { recursive: true });
    fs.writeFileSync(path.join(subDir, '.npmrc'), 'registry = https://spaced-registry.example.com/\n');
    expect(getRegistryFromNpmrc(subDir)).toBe('https://spaced-registry.example.com/');
  });

  it('ignores comments and empty lines', () => {
    const subDir = path.join(tmpDir, 'comments-npmrc');
    fs.mkdirSync(subDir, { recursive: true });
    fs.writeFileSync(
      path.join(subDir, '.npmrc'),
      ['# this is a comment', '', '; another comment', 'registry=https://real-registry.example.com/'].join('\n')
    );
    expect(getRegistryFromNpmrc(subDir)).toBe('https://real-registry.example.com/');
  });

  it('returns first registry line if multiple are present', () => {
    const subDir = path.join(tmpDir, 'multi-npmrc');
    fs.mkdirSync(subDir, { recursive: true });
    fs.writeFileSync(
      path.join(subDir, '.npmrc'),
      ['registry=https://first.example.com/', 'registry=https://second.example.com/'].join('\n')
    );
    expect(getRegistryFromNpmrc(subDir)).toBe('https://first.example.com/');
  });

  it('returns undefined when .npmrc has no registry setting', () => {
    const subDir = path.join(tmpDir, 'no-registry');
    fs.mkdirSync(subDir, { recursive: true });
    fs.writeFileSync(path.join(subDir, '.npmrc'), '//registry.example.com/:_authToken=some-token\n');
    const origHome = process.env.HOME;
    process.env.HOME = subDir; // ensure user .npmrc is the same file (no registry)
    try {
      const result = getRegistryFromNpmrc(subDir);
      expect(result).toBeUndefined();
    } finally {
      process.env.HOME = origHome;
    }
  });

  it('handles Windows-style line endings', () => {
    const subDir = path.join(tmpDir, 'crlf-npmrc');
    fs.mkdirSync(subDir, { recursive: true });
    fs.writeFileSync(path.join(subDir, '.npmrc'), 'some-setting=foo\r\nregistry=https://win-registry.example.com/\r\n');
    expect(getRegistryFromNpmrc(subDir)).toBe('https://win-registry.example.com/');
  });

  it('is case-insensitive for the registry key', () => {
    const subDir = path.join(tmpDir, 'case-npmrc');
    fs.mkdirSync(subDir, { recursive: true });
    fs.writeFileSync(path.join(subDir, '.npmrc'), 'Registry=https://case-registry.example.com/\n');
    expect(getRegistryFromNpmrc(subDir)).toBe('https://case-registry.example.com/');
  });

  it('substitutes ${VAR} with environment variable values', () => {
    const subDir = path.join(tmpDir, 'envvar-npmrc');
    fs.mkdirSync(subDir, { recursive: true });
    fs.writeFileSync(path.join(subDir, '.npmrc'), 'registry=https://${REGISTRY_HOST}/npm/\n');
    const env = { REGISTRY_HOST: 'my-private-registry.example.com' } as NodeJS.ProcessEnv;
    expect(getRegistryFromNpmrc(subDir, env)).toBe('https://my-private-registry.example.com/npm/');
  });

  it('substitutes multiple ${VAR} references in the same value', () => {
    const subDir = path.join(tmpDir, 'multi-envvar-npmrc');
    fs.mkdirSync(subDir, { recursive: true });
    fs.writeFileSync(path.join(subDir, '.npmrc'), 'registry=${PROTO}://${HOST}/\n');
    const env = { PROTO: 'https', HOST: 'registry.example.com' } as NodeJS.ProcessEnv;
    expect(getRegistryFromNpmrc(subDir, env)).toBe('https://registry.example.com/');
  });

  it('replaces unset ${VAR} with empty string', () => {
    const subDir = path.join(tmpDir, 'unset-envvar-npmrc');
    fs.mkdirSync(subDir, { recursive: true });
    fs.writeFileSync(path.join(subDir, '.npmrc'), 'registry=https://registry.example.com/${MISSING_PATH}\n');
    const env = {} as NodeJS.ProcessEnv;
    expect(getRegistryFromNpmrc(subDir, env)).toBe('https://registry.example.com/');
  });

  it('does not substitute $VAR without braces', () => {
    const subDir = path.join(tmpDir, 'no-brace-envvar-npmrc');
    fs.mkdirSync(subDir, { recursive: true });
    fs.writeFileSync(path.join(subDir, '.npmrc'), 'registry=https://$REGISTRY_HOST/npm/\n');
    const env = { REGISTRY_HOST: 'substituted.example.com' } as NodeJS.ProcessEnv;
    expect(getRegistryFromNpmrc(subDir, env)).toBe('https://$REGISTRY_HOST/npm/');
  });
});
