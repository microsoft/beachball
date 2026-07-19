import { describe, it, expect, afterEach, beforeAll, jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { createTestFileStructure } from '../../__fixtures__/createTestFileStructure';
import { removeTempDir } from '../../__fixtures__/tmpdir';
import { updateLockFileRegistry } from '../../commands/updateLockFileRegistry';
import { BeachballError } from '../../types/BeachballError';

const fixturesDir = path.join(__dirname, '../../__fixtures__/lockfiles');

/** Private registry passed to `updateLockFileRegistry` in each test. */
const registry = 'https://pkgs.dev.azure.com/office/_packaging/Office/npm/registry/';

/** The public registry URLs the fixtures were generated against. */
const npmjsRegistry = 'https://registry.npmjs.org/';
const yarnpkgRegistry = 'https://registry.yarnpkg.com/';

const readFixture = (name: string): string => fs.readFileSync(path.join(fixturesDir, name), 'utf-8');

describe('updateLockFileRegistry', () => {
  let tempDir = '';
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;

  beforeAll(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    removeTempDir(tempDir);
    tempDir = '';
  });

  const read = (name: string): string => fs.readFileSync(path.join(tempDir, name), 'utf-8');

  it('throws when the registry option is missing', () => {
    tempDir = createTestFileStructure({});

    expect(() => updateLockFileRegistry({ path: tempDir, registry: '' })).toThrow(BeachballError);
    expect(() => updateLockFileRegistry({ path: tempDir, registry: '' })).toThrow('The "registry" option is required');
  });

  it('skips yarn berry (yarn.lock alongside .yarnrc.yml)', () => {
    tempDir = createTestFileStructure({ 'yarn.lock': '', '.yarnrc.yml': 'nodeLinker: node-modules\n' });

    updateLockFileRegistry({ path: tempDir, registry });
    expect(consoleLogSpy).toHaveBeenCalledWith(
      'Skipping lock file update for current package manager which does not embed URLs'
    );
  });

  it('skips pnpm (pnpm-lock.yaml does not embed default registry URLs)', () => {
    tempDir = createTestFileStructure({ 'pnpm-lock.yaml': '' });

    updateLockFileRegistry({ path: tempDir, registry });
    expect(consoleLogSpy).toHaveBeenCalledWith(
      'Skipping lock file update for current package manager which does not embed URLs'
    );
  });

  it('skips when the registry is the default registry', () => {
    const original = readFixture('npm.package-lock.json.fixture');
    tempDir = createTestFileStructure({ 'package-lock.json': original });

    updateLockFileRegistry({ path: tempDir, registry: npmjsRegistry });
    expect(consoleLogSpy).toHaveBeenCalledWith('Skipping lock file update for default registry');
  });

  it('normalizes a registry without a trailing slash', () => {
    const original = readFixture('npm.package-lock.json.fixture');
    tempDir = createTestFileStructure({ 'package-lock.json': original });

    updateLockFileRegistry({ path: tempDir, registry: registry.replace(/\/$/, '') });

    const updated = read('package-lock.json');
    expect(updated).toBe(original.replaceAll(npmjsRegistry, registry));
  });

  it('throws when the lock file does not contain the default registry', () => {
    tempDir = createTestFileStructure({ 'package-lock.json': '{}\n' });

    expect(() => updateLockFileRegistry({ path: tempDir, registry })).toThrow(BeachballError);
    expect(() => updateLockFileRegistry({ path: tempDir, registry })).toThrow(
      'does not contain https://registry.npmjs.org/'
    );
  });

  it('rewrites registry URLs in an npm package-lock.json', () => {
    const original = readFixture('npm.package-lock.json.fixture');
    tempDir = createTestFileStructure({ 'package-lock.json': original });

    updateLockFileRegistry({ path: tempDir, registry });

    const updated = read('package-lock.json');
    expect(updated).toBe(original.replaceAll(npmjsRegistry, registry));
    expect(updated).not.toContain(npmjsRegistry);
    expect(updated).toContain(`${registry}is-number/-/is-number-7.0.0.tgz`);
  });

  it('rewrites registry URLs in a yarn v1 yarn.lock', () => {
    const original = readFixture('yarn-v1.yarn.lock.fixture');
    tempDir = createTestFileStructure({ 'yarn.lock': original });

    updateLockFileRegistry({ path: tempDir, registry });

    const updated = read('yarn.lock');
    expect(updated).toBe(original.replaceAll(yarnpkgRegistry, registry));
    expect(updated).not.toContain(yarnpkgRegistry);
    expect(updated).toContain(`${registry}is-odd/-/is-odd-3.0.1.tgz`);
  });

  it('reverts registry URLs back to the default registry', () => {
    const original = readFixture('npm.package-lock.json.fixture');
    // simulate a lock file that was previously updated to the private registry
    const withPrivateRegistry = original.replaceAll(npmjsRegistry, registry);
    tempDir = createTestFileStructure({ 'package-lock.json': withPrivateRegistry });

    updateLockFileRegistry({ path: tempDir, registry, revert: true });

    const updated = read('package-lock.json');
    expect(updated).toBe(original);
    expect(updated).not.toContain(registry);
  });
});
