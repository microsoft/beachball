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
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
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

  it('copies .npmrc.publish to .npmrc', () => {
    const dir = setupRepo();

    expect(preparePublishRegistry(dir)).toBe(registry);
    expect(exists(dir, '.npmrc')).toBe(true);
    expect(read(dir, '.npmrc')).toBe(read(dir, '.npmrc.publish'));
  });

  it('returns undefined and makes no changes when .npmrc.publish has no registry', () => {
    const dir = setupRepo({ 'package-lock.json': readFixture('npm.package-lock.json.fixture') }, `always-auth=true\n`);

    expect(preparePublishRegistry(dir)).toBeUndefined();
    expect(exists(dir, '.npmrc')).toBe(false);
    // lock file left untouched
    expect(read(dir, 'package-lock.json')).toBe(readFixture('npm.package-lock.json.fixture'));
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

  it('updates .yarnrc.yml and leaves the yarn berry lock file unchanged', () => {
    const original = readFixture('yarn-berry.yarn.lock.fixture');
    const dir = setupRepo({ '.yarnrc.yml': 'nodeLinker: node-modules\n', 'yarn.lock': original });

    preparePublishRegistry(dir);

    // berry resolves from npmRegistryServer, so its lock file has no URLs to rewrite
    expect(read(dir, 'yarn.lock')).toBe(original);

    const yarnrc = read(dir, '.yarnrc.yml');
    expect(yarnrc).toContain('nodeLinker: node-modules');
    expect(yarnrc).toContain(`npmRegistryServer: "${registry}"`);
    expect(yarnrc).toContain('npmAlwaysAuth: true');
    expect(yarnrc).toContain('npmrcAuthEnabled: true');
  });

  it('does not create .yarnrc.yml when it does not already exist', () => {
    const dir = setupRepo({ 'package-lock.json': readFixture('npm.package-lock.json.fixture') });

    preparePublishRegistry(dir);

    expect(exists(dir, '.yarnrc.yml')).toBe(false);
  });

  it('leaves a pnpm-lock.yaml unchanged (pnpm relies on the .npmrc copy)', () => {
    const original = readFixture('pnpm.pnpm-lock.yaml.fixture');
    const dir = setupRepo({ 'pnpm-lock.yaml': original });

    preparePublishRegistry(dir);

    expect(exists(dir, '.npmrc')).toBe(true);
    expect(read(dir, 'pnpm-lock.yaml')).toBe(original);
  });
});
