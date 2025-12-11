import { describe, expect, it, beforeEach, jest, afterEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import { removeTempDir, tmpdir } from '../../__fixtures__/tmpdir';
import * as npmModuleType from '../../packageManager/npm';
import type { NpmResult } from '../../packageManager/npm';
import { packPackage } from '../../packageManager/packPackage';
import { PackageInfo } from '../../types/PackageInfo';
import { getMockNpmPackName, initNpmMock } from '../../__fixtures__/mockNpm';
import { writeJson } from '../../object/writeJson';

// Spawning actual npm is slow, so mock it for most of these tests.
// A couple tests also use the real npm command.
jest.mock('../../packageManager/npm');

const { npm: actualNpm } = jest.requireActual<typeof npmModuleType>('../../packageManager/npm');

describe('packPackage', () => {
  const npmMock = initNpmMock();
  let tempRoot: string;
  let tempPackageJsonPath = '';
  let tempPackPath: string;

  const logs = initMockLogs();

  function getTestPackage(name: string) {
    const version = '0.6.0';
    const json = { name, version };
    const info: PackageInfo = {
      ...json,
      packageJsonPath: tempPackageJsonPath,
      private: false,
      combinedOptions: {} as PackageInfo['combinedOptions'],
      packageOptions: {} as PackageInfo['packageOptions'],
    };
    return {
      name,
      version,
      json,
      info,
      spec: `${name}@${version}`,
      packName: getMockNpmPackName({ name, version }),
    };
  }

  beforeEach(() => {
    tempRoot = tmpdir();
    tempPackageJsonPath = path.join(tempRoot, 'package.json');
    tempPackPath = tmpdir();
  });

  afterEach(() => {
    removeTempDir(tempRoot);
    removeTempDir(tempPackPath);
  });

  it('packs package', async () => {
    const testPkg = getTestPackage('testpkg');
    writeJson(tempPackageJsonPath, testPkg.json);

    const packResult = await packPackage(testPkg.info, { packToPath: tempPackPath, index: 0, total: 1 });
    expect(packResult).toEqual(true);
    expect(npmMock.mock).toHaveBeenCalledTimes(1);
    expect(npmMock.mock).toHaveBeenCalledWith(
      ['pack', '--loglevel', 'warn'],
      expect.objectContaining({ cwd: tempRoot })
    );
    // file is moved to correct location (not the package folder)
    expect(fs.existsSync(path.join(tempPackPath, '1-' + testPkg.packName))).toBe(true);
    expect(fs.existsSync(path.join(tempRoot, testPkg.packName))).toBe(false);

    const allLogs = logs.getMockLines('all');
    expect(allLogs).toMatch(`Packing - ${testPkg.spec}`);
    expect(allLogs).toMatch(`Packed ${testPkg.spec} to ${path.join(tempPackPath, '1-' + testPkg.packName)}`);
  });

  it('packs scoped package', async () => {
    const testPkg = getTestPackage('@foo/bar');
    writeJson(tempPackageJsonPath, testPkg.json);

    const packResult = await packPackage(testPkg.info, { packToPath: tempPackPath, index: 0, total: 1 });
    expect(packResult).toEqual(true);
    expect(npmMock.mock).toHaveBeenCalledTimes(1);
    expect(npmMock.mock).toHaveBeenCalledWith(
      ['pack', '--loglevel', 'warn'],
      expect.objectContaining({ cwd: tempRoot })
    );
    // file is moved to correct location (not the package folder)
    expect(fs.existsSync(path.join(tempPackPath, '1-' + testPkg.packName))).toBe(true);
    expect(fs.existsSync(path.join(tempRoot, testPkg.packName))).toBe(false);

    const allLogs = logs.getMockLines('all');
    expect(allLogs).toMatch(`Packing - ${testPkg.spec}`);
    expect(allLogs).toMatch(`Packed ${testPkg.spec} to ${path.join(tempPackPath, '1-' + testPkg.packName)}`);
  });

  it('packs package with correct longer prefix', async () => {
    const testPkg = getTestPackage('testpkg');
    writeJson(tempPackageJsonPath, testPkg.json);

    // There are 100 packages to pack, so index 1 should be prefixed with "002-"
    const packResult = await packPackage(testPkg.info, { packToPath: tempPackPath, index: 1, total: 100 });
    expect(packResult).toEqual(true);
    expect(npmMock.mock).toHaveBeenCalledTimes(1);
    expect(npmMock.mock).toHaveBeenCalledWith(
      ['pack', '--loglevel', 'warn'],
      expect.objectContaining({ cwd: tempRoot })
    );
    expect(fs.existsSync(path.join(tempPackPath, '002-' + testPkg.packName))).toBe(true);
    expect(fs.existsSync(path.join(tempRoot, testPkg.packName))).toBe(false);

    const allLogs = logs.getMockLines('all');
    expect(allLogs).toMatch(`Packing - ${testPkg.spec}`);
    expect(allLogs).toMatch(`Packed ${testPkg.spec} to ${path.join(tempPackPath, '002-' + testPkg.packName)}`);
  });

  it('handles failure packing', async () => {
    const testPkg = getTestPackage('testpkg');
    // It's difficult to simulate actual error conditions, so mock an npm call failure.
    npmMock.setCommandOverride('pack', () =>
      Promise.resolve({ success: false, stdout: 'oh no', all: 'oh no' } as NpmResult)
    );

    const packResult = await packPackage(testPkg.info, { packToPath: tempPackPath, index: 0, total: 1 });
    expect(packResult).toEqual(false);
    expect(npmMock.mock).toHaveBeenCalledTimes(1);
    expect(fs.existsSync(path.join(tempRoot, testPkg.packName))).toBe(false);
    expect(fs.existsSync(path.join(tempPackPath, testPkg.packName))).toBe(false);

    const allLogs = logs.getMockLines('all');
    expect(allLogs).toMatch(`Packing - ${testPkg.spec}`);
    expect(allLogs).toMatch(`Packing ${testPkg.spec} failed (see above for details)`);
  });

  it('handles if filename is missing from output', async () => {
    const testPkg = getTestPackage('testpkg');
    npmMock.setCommandOverride('pack', () =>
      Promise.resolve({ success: true, stdout: 'not a file', all: 'not a file' } as NpmResult)
    );

    const packResult = await packPackage(testPkg.info, { packToPath: tempPackPath, index: 0, total: 1 });
    expect(packResult).toEqual(false);
    expect(npmMock.mock).toHaveBeenCalledTimes(1);
    expect(fs.existsSync(path.join(tempRoot, testPkg.packName))).toBe(false);
    expect(fs.existsSync(path.join(tempPackPath, testPkg.packName))).toBe(false);

    const allLogs = logs.getMockLines('all');
    expect(allLogs).toMatch(`Packing - ${testPkg.spec}`);
    expect(allLogs).toMatch(`npm pack output for ${testPkg.spec} (above) did not end with a filename that exists`);
  });

  it('handles if filename in output does not exist', async () => {
    const testPkg = getTestPackage('testpkg');
    npmMock.setCommandOverride('pack', () =>
      Promise.resolve({ success: true, stdout: 'nope.tgz', all: 'nope.tgz' } as NpmResult)
    );

    const packResult = await packPackage(testPkg.info, { packToPath: tempPackPath, index: 0, total: 1 });
    expect(packResult).toEqual(false);
    expect(npmMock.mock).toHaveBeenCalledTimes(1);
    expect(fs.existsSync(path.join(tempRoot, testPkg.packName))).toBe(false);
    expect(fs.existsSync(path.join(tempPackPath, testPkg.packName))).toBe(false);

    const allLogs = logs.getMockLines('all');
    expect(allLogs).toMatch(`Packing - ${testPkg.spec}`);
    expect(allLogs).toMatch(`npm pack output for ${testPkg.spec} (above) did not end with a filename that exists`);
  });

  it('handles failure moving file', async () => {
    const testPkg = getTestPackage('testpkg');
    writeJson(tempPackageJsonPath, testPkg.json);

    fs.writeFileSync(path.join(tempPackPath, '1-' + testPkg.packName), 'other content');

    const packResult = await packPackage(testPkg.info, { packToPath: tempPackPath, index: 0, total: 1 });
    expect(packResult).toEqual(false);
    expect(npmMock.mock).toHaveBeenCalledTimes(1);

    const allLogs = logs.getMockLines('all');
    expect(allLogs).toMatch(`Packing - ${testPkg.spec}`);
    expect(allLogs).toMatch(
      `Failed to move ${path.join(tempRoot, testPkg.packName)} to ${path.join(
        tempPackPath,
        '1-' + testPkg.packName
      )}: Error:`
    );

    // tgz file is cleaned up
    expect(fs.existsSync(path.join(tempRoot, testPkg.packName))).toBe(false);
  });

  // These tests are slow, so only cover minimal cases
  describe('real npm', () => {
    beforeEach(() => {
      npmMock.setCommandOverride('pack', (_, args, opts) => {
        return actualNpm(['pack', ...args], opts);
      });
    });

    it('packs scoped package', async () => {
      const testPkg = getTestPackage('@foo/bar');
      writeJson(tempPackageJsonPath, testPkg.json);

      const packResult = await packPackage(testPkg.info, { packToPath: tempPackPath, index: 0, total: 1 });
      expect(packResult).toEqual(true);
      expect(npmMock.mock).toHaveBeenCalledTimes(1);
      expect(npmMock.mock).toHaveBeenCalledWith(
        ['pack', '--loglevel', 'warn'],
        expect.objectContaining({ cwd: tempRoot })
      );
      // file is moved to correct location (not the package folder)
      expect(fs.existsSync(path.join(tempPackPath, '1-' + testPkg.packName))).toBe(true);
      expect(fs.existsSync(path.join(tempRoot, testPkg.packName))).toBe(false);

      const allLogs = logs.getMockLines('all');
      expect(allLogs).toMatch(`Packing - ${testPkg.spec}`);
      expect(allLogs).toMatch(`Packed ${testPkg.spec} to ${path.join(tempPackPath, '1-' + testPkg.packName)}`);
    });
  });
});
