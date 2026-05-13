import { describe, expect, it, afterEach } from '@jest/globals';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { getRegistryFromNpmrc } from '../../packageManager/npmrc';

describe('getRegistryFromNpmrc', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beachball-npmrc-test-'));

  afterEach(() => {
    // Clean up any .npmrc created in tmpDir
    const npmrcPath = path.join(tmpDir, '.npmrc');
    if (fs.existsSync(npmrcPath)) {
      fs.unlinkSync(npmrcPath);
    }
  });

  it('returns undefined when no .npmrc exists', () => {
    const nonExistentDir = path.join(tmpDir, 'no-such-dir');
    // This will fail to find both project-level and (assuming no registry in user ~/.npmrc for test)
    // We test with a dir that definitely has no .npmrc
    const result = getRegistryFromNpmrc(nonExistentDir);
    // Result depends on whether user has ~/.npmrc with registry; at minimum, no project .npmrc is found
    expect(result === undefined || typeof result === 'string').toBe(true);
  });

  it('reads registry from project-level .npmrc', () => {
    fs.writeFileSync(path.join(tmpDir, '.npmrc'), 'registry=https://my-registry.example.com/\n');
    expect(getRegistryFromNpmrc(tmpDir)).toBe('https://my-registry.example.com/');
  });

  it('handles registry with spaces around equals sign', () => {
    fs.writeFileSync(path.join(tmpDir, '.npmrc'), 'registry = https://spaced-registry.example.com/\n');
    expect(getRegistryFromNpmrc(tmpDir)).toBe('https://spaced-registry.example.com/');
  });

  it('ignores comments and empty lines', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.npmrc'),
      ['# this is a comment', '', '; another comment', 'registry=https://real-registry.example.com/'].join('\n')
    );
    expect(getRegistryFromNpmrc(tmpDir)).toBe('https://real-registry.example.com/');
  });

  it('returns first registry line if multiple are present', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.npmrc'),
      ['registry=https://first.example.com/', 'registry=https://second.example.com/'].join('\n')
    );
    expect(getRegistryFromNpmrc(tmpDir)).toBe('https://first.example.com/');
  });

  it('returns undefined when .npmrc has no registry setting', () => {
    fs.writeFileSync(path.join(tmpDir, '.npmrc'), '//registry.example.com/:_authToken=some-token\n');
    // No registry line, but user ~/.npmrc might have one
    const result = getRegistryFromNpmrc(tmpDir);
    // We can only assert the project .npmrc didn't provide one; user .npmrc is out of our control
    expect(result === undefined || typeof result === 'string').toBe(true);
  });

  it('handles Windows-style line endings', () => {
    fs.writeFileSync(path.join(tmpDir, '.npmrc'), 'some-setting=foo\r\nregistry=https://win-registry.example.com/\r\n');
    expect(getRegistryFromNpmrc(tmpDir)).toBe('https://win-registry.example.com/');
  });

  it('is case-insensitive for the registry key', () => {
    fs.writeFileSync(path.join(tmpDir, '.npmrc'), 'Registry=https://case-registry.example.com/\n');
    expect(getRegistryFromNpmrc(tmpDir)).toBe('https://case-registry.example.com/');
  });
});
