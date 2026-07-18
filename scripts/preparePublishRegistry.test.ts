import { describe, it, expect, afterEach, beforeAll, afterAll, jest } from '@jest/globals';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { getPublishRegistry, preparePublishRegistry } from './preparePublishRegistry.ts';

const fixturesDir = path.join(import.meta.dirname, '__fixtures__/lockfiles');

/** Private registry written to `.npmrc.publish` in each test repo. */
const registry = 'https://pkgs.dev.azure.com/office/_packaging/Office/npm/registry/';

/** The public registry URLs the fixtures were generated against. */
const npmjsRegistry = 'https://registry.npmjs.org/';
const yarnpkgRegistry = 'https://registry.yarnpkg.com/';

const readFixture = (name: string): string => fs.readFileSync(path.join(fixturesDir, name), 'utf-8');

describe('preparePublishRegistry', () => {
  const tempDirs: string[] = [];

  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  /** Create a temp repo with a `.npmrc.publish` and the given files, and return its path. */
  function setupRepo(files: Record<string, string> = {}, publishNpmrc = `registry=${registry}\n`): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ppr-test-'));
    tempDirs.push(dir);
    fs.writeFileSync(path.join(dir, '.npmrc.publish'), publishNpmrc);
    for (const [name, content] of Object.entries(files)) {
      fs.writeFileSync(path.join(dir, name), content);
    }
    return dir;
  }

  const read = (dir: string, name: string): string => fs.readFileSync(path.join(dir, name), 'utf-8');
  const exists = (dir: string, name: string): boolean => fs.existsSync(path.join(dir, name));

  describe('getPublishRegistry', () => {
    it('reads the registry from .npmrc.publish', () => {
      const dir = setupRepo();
      expect(getPublishRegistry(dir)).toBe(registry);
    });

    it('strips surrounding quotes and trailing content', () => {
      const dir = setupRepo({}, `always-auth=true\nregistry="${registry}" # comment\n`);
      expect(getPublishRegistry(dir)).toBe(registry);
    });

    it('returns undefined when there is no registry line', () => {
      const dir = setupRepo({}, `always-auth=true\n`);
      expect(getPublishRegistry(dir)).toBeUndefined();
    });
  });

  it('returns undefined and makes no changes when .npmrc.publish has no registry', () => {
    const original = readFixture('npm.package-lock.json.fixture');
    const dir = setupRepo({ 'package-lock.json': original }, `always-auth=true\n`);

    expect(preparePublishRegistry(dir)).toBeUndefined();
    expect(exists(dir, '.npmrc')).toBe(false);
    expect(read(dir, 'package-lock.json')).toBe(original);
    expect(console.error).toHaveBeenCalledWith(`No registry found in ${path.join(dir, '.npmrc.publish')}`);
  });

  it('rewrites registry URLs in an npm package-lock.json', () => {
    const original = readFixture('npm.package-lock.json.fixture');
    const dir = setupRepo({ 'package-lock.json': original });

    preparePublishRegistry(dir);

    const updated = read(dir, 'package-lock.json');
    expect(updated).toBe(original.split(npmjsRegistry).join(registry));
    expect(updated).not.toContain(npmjsRegistry);
    expect(updated).toContain(`${registry}is-number/-/is-number-7.0.0.tgz`);
  });

  it('rewrites registry URLs in a yarn v1 yarn.lock', () => {
    const original = readFixture('yarn-v1.yarn.lock.fixture');
    const dir = setupRepo({ 'yarn.lock': original });

    preparePublishRegistry(dir);

    const updated = read(dir, 'yarn.lock');
    expect(updated).toBe(original.split(yarnpkgRegistry).join(registry));
    expect(updated).not.toContain(yarnpkgRegistry);
    expect(updated).toContain(`${registry}is-odd/-/is-odd-3.0.1.tgz`);
  });

  it('rewrites npm lock file URLs when .npmrc.publish registry omits trailing slash', () => {
    const original = readFixture('npm.package-lock.json.fixture');
    const registryNoSlash = registry.slice(0, -1);
    const dir = setupRepo({ 'package-lock.json': original }, `registry=${registryNoSlash}\n`);

    preparePublishRegistry(dir);

    const updated = read(dir, 'package-lock.json');
    expect(updated).toBe(original.split(npmjsRegistry).join(registry));
    expect(updated).not.toContain(`${registryNoSlash}is-number/-/is-number-7.0.0.tgz`);
    expect(updated).toContain(`${registry}is-number/-/is-number-7.0.0.tgz`);
  });

  it('rewrites yarn v1 lock file URLs when .npmrc.publish registry omits trailing slash', () => {
    const original = readFixture('yarn-v1.yarn.lock.fixture');
    const registryNoSlash = registry.slice(0, -1);
    const dir = setupRepo({ 'yarn.lock': original }, `registry=${registryNoSlash}\n`);

    preparePublishRegistry(dir);

    const updated = read(dir, 'yarn.lock');
    expect(updated).toBe(original.split(yarnpkgRegistry).join(registry));
    expect(updated).not.toContain(`${registryNoSlash}is-odd/-/is-odd-3.0.1.tgz`);
    expect(updated).toContain(`${registry}is-odd/-/is-odd-3.0.1.tgz`);
  });

  it('for yarn berry, emits YARN_* ADO variables and leaves files unchanged', () => {
    const originalLock = readFixture('yarn-berry.yarn.lock.fixture');
    const originalYarnrc = 'nodeLinker: node-modules\nplugins:\n  - path: .yarn/plugins/yarn-plugins/npmrc.cjs\n';
    const dir = setupRepo({ '.yarnrc.yml': originalYarnrc, 'yarn.lock': originalLock });

    expect(preparePublishRegistry(dir)).toBe(registry);

    expect(read(dir, 'yarn.lock')).toBe(originalLock);
    expect(read(dir, '.yarnrc.yml')).toBe(originalYarnrc);

    const logs = (console.log as jest.Mock).mock.calls.map(args => args.join(' ')).join('\n');
    expect(logs).toContain(`##fake[task.setvariable variable=YARN_NPM_REGISTRY_SERVER]${registry}`);
    expect(logs).toContain('##fake[task.setvariable variable=YARN_NPM_ALWAYS_AUTH]true');
    expect(logs).toContain('##fake[task.setvariable variable=YARN_NPMRC_AUTH_ENABLED]true');
  });

  it('for yarn berry, fails when yarn-plugin-npmrc is not installed', () => {
    const originalLock = readFixture('yarn-berry.yarn.lock.fixture');
    const dir = setupRepo({ '.yarnrc.yml': 'nodeLinker: node-modules\n', 'yarn.lock': originalLock });

    expect(preparePublishRegistry(dir)).toBeUndefined();
    expect(read(dir, 'yarn.lock')).toBe(originalLock);

    expect(console.error).toHaveBeenCalledWith(
      `yarn-plugin-npmrc is not installed in ${path.join(dir, '.yarnrc.yml')}\n` +
        '(add it from https://github.com/microsoft/beachball/tree/main/yarn-plugins/npmrc )'
    );
  });

  it('leaves a pnpm-lock.yaml unchanged (pnpm lock rewrite is not needed)', () => {
    const original = readFixture('pnpm.pnpm-lock.yaml.fixture');
    const dir = setupRepo({ 'pnpm-lock.yaml': original });

    preparePublishRegistry(dir);

    expect(exists(dir, '.npmrc')).toBe(false);
    expect(read(dir, 'pnpm-lock.yaml')).toBe(original);
  });
});
