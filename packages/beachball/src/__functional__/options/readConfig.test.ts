import { afterEach, describe, expect, it } from '@jest/globals';
import { createTestFileStructure, expectError, removeTempDir } from '@microsoft/beachball-test-utilities';
import path from 'node:path';
import { readConfig } from '../../options/readConfig';
import { BeachballError } from '../../types/BeachballError';

describe('readConfig', () => {
  let tempDir = '';
  const packageJson = { name: 'foo', version: '1.0.0' };
  const sampleConfig = { branch: 'origin/foo' };
  const sampleJson = JSON.stringify(sampleConfig);
  const sampleCjs = 'module.exports = ' + sampleJson;
  const sampleMjs = 'export default ' + sampleJson;

  function configResult(filename: string, config = sampleConfig) {
    return { configPath: path.join(tempDir, filename), config };
  }

  // Don't reuse a temp dir across tests! If multiple tests load a JS config from the same path,
  // it will use the version from the module cache, which will have outdated contents.
  afterEach(() => {
    tempDir && removeTempDir(tempDir);
    tempDir = '';
  });

  it('returns undefined if no config is found', async () => {
    tempDir = createTestFileStructure({ 'package.json': packageJson });

    expect(await readConfig({ path: tempDir })).toBeUndefined();
  });

  it('reads config from a package.json property', async () => {
    tempDir = createTestFileStructure({
      'package.json': { ...packageJson, beachball: sampleConfig },
    });

    expect(await readConfig({ path: tempDir })).toEqual(configResult('package.json'));
  });

  // The .cts test isn't realistic because it goes through jest, but it ensures readConfig finds the file
  const cjsExts = ['.js', '.cjs', '.ts', '.cts'] as const;
  it.each([...cjsExts.map(ext => `beachball.config${ext}`), ...cjsExts.map(ext => `.beachballrc${ext}`)])(
    'reads CJS %s',
    async filename => {
      tempDir = createTestFileStructure({
        'package.json': packageJson,
        [filename]: (filename.endsWith('ts') ? 'const foo: number = 1;\n' : '') + sampleCjs,
      });

      expect(await readConfig({ path: tempDir })).toEqual(configResult(filename));
    }
  );

  const mjsExts = ['.js', '.mjs', '.ts', '.mts'] as const;
  it.each([...mjsExts.map(ext => `beachball.config${ext}`), ...mjsExts.map(ext => `.beachballrc${ext}`)])(
    'reads ESM %s',
    async filename => {
      tempDir = createTestFileStructure({
        // type: module ensures it reads the .ts
        'package.json': { ...packageJson, type: 'module' },
        [filename]: (filename.endsWith('ts') ? 'const foo: number = 1;\n' : '') + sampleMjs,
      });

      expect(await readConfig({ path: tempDir })).toEqual(configResult(filename));
    }
  );

  it.each(['beachball.config.json', '.beachballrc', '.beachballrc.json'])('reads config from %s', async filename => {
    tempDir = createTestFileStructure({
      'package.json': packageJson,
      [filename]: sampleJson,
    });

    expect(await readConfig({ path: tempDir })).toEqual(configResult(filename));
  });

  it('reads config from a .config directory', async () => {
    tempDir = createTestFileStructure({
      'package.json': packageJson,
      '.config/beachball.config.js': sampleCjs,
    });

    expect(await readConfig({ path: tempDir })).toEqual(configResult('.config/beachball.config.js'));
  });

  it('prefers the package.json property over other config files', async () => {
    tempDir = createTestFileStructure({
      'package.json': { ...packageJson, beachball: { branch: 'origin/from-package-json' } },
      'beachball.config.js': 'module.exports = { branch: "origin/from-config-js" };',
    });

    expect(await readConfig({ path: tempDir })).toEqual(
      configResult('package.json', { branch: 'origin/from-package-json' })
    );
  });

  it('prefers the cwd over the .config directory', async () => {
    tempDir = createTestFileStructure({
      'package.json': packageJson,
      'beachball.config.js': 'module.exports = { branch: "origin/from-cwd" };',
      '.config/beachball.config.js': 'module.exports = { branch: "origin/from-config-dir" };',
    });

    expect(await readConfig({ path: tempDir })).toEqual(
      configResult('beachball.config.js', { branch: 'origin/from-cwd' })
    );
  });

  it('loads config from a relative configPath', async () => {
    tempDir = createTestFileStructure({
      'package.json': packageJson,
      'beachball.config.js': 'module.exports = { branch: "origin/main" };',
      'alternate.config.js': 'module.exports = { branch: "origin/foo" };',
    });

    expect(await readConfig({ path: tempDir, configPath: 'alternate.config.js' })).toEqual(
      configResult('alternate.config.js')
    );
  });

  it('loads config from an absolute configPath', async () => {
    tempDir = createTestFileStructure({
      'package.json': packageJson,
      'nested/alternate.config.js': 'module.exports = { branch: "origin/foo" };',
    });
    const configPath = path.join(tempDir, 'nested/alternate.config.js');

    expect(await readConfig({ path: tempDir, configPath })).toEqual(configResult('nested/alternate.config.js'));
  });

  it('throws if configPath could not be loaded', async () => {
    const configPath = 'bad.config.js';
    tempDir = createTestFileStructure({
      'package.json': packageJson,
      [configPath]: 'throw new Error("oh no")',
    });
    const readBad = () => readConfig({ path: tempDir, configPath });

    await expectError(readBad(), BeachballError, `Failed to load config from ${path.join(tempDir, configPath)}: oh no`);
  });

  it('throws if a JSON config is invalid', async () => {
    tempDir = createTestFileStructure({
      'package.json': packageJson,
      '.beachballrc.json': '{ not valid json',
    });

    await expect(readConfig({ path: tempDir })).rejects.toThrow(
      `Failed to load config from ${path.join(tempDir, '.beachballrc.json')}`
    );
  });
});
