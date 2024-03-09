import { describe, expect, it, beforeAll, afterAll, beforeEach, jest, afterEach } from '@jest/globals';
import fs from 'fs-extra';
import path from 'path';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import { tmpdir } from '../../__fixtures__/tmpdir';
import * as npmModule from '../../packageManager/npm';
import { packPackage } from '../../packageManager/packPackage';
import { PackageInfo } from '../../types/PackageInfo';
import { npm } from '../../packageManager/npm';

const testName = 'testbeachballpackage';
const testVersion = '0.6.0';
const testSpec = `${testName}@${testVersion}`;
const testPackage = { name: testName, version: testVersion };
const testPackName = `${testName}-${testVersion}.tgz`;

describe('packPackage', () => {
  let npmSpy: jest.SpiedFunction<typeof npm>;
  let tempRoot: string;
  let tempPackageJsonPath: string;
  let tempPackPath: string;

  const logs = initMockLogs();

  function getTestPackageInfo(): PackageInfo {
    return {
      ...testPackage,
      packageJsonPath: tempPackageJsonPath,
      private: false,
      combinedOptions: {} as any,
      packageOptions: {} as any,
    };
  }

  beforeAll(() => {
    tempRoot = tmpdir();
    tempPackageJsonPath = path.join(tempRoot, 'package.json');
    tempPackPath = tmpdir();
  });

  beforeEach(() => {
    npmSpy = jest.spyOn(npmModule, 'npm');
  });

  afterEach(() => {
    npmSpy.mockRestore();
    fs.emptyDirSync(tempRoot);
    fs.emptyDirSync(tempPackPath);
  });

  afterAll(() => {
    fs.removeSync(tempRoot);
    fs.removeSync(tempPackPath);
  });

  it('does nothing if packToPath is not specified', async () => {
    const testPackageInfo = getTestPackageInfo();
    fs.writeJSONSync(tempPackageJsonPath, testPackage, { spaces: 2 });

    const packResult = await packPackage(testPackageInfo, {});
    expect(packResult).toEqual({ success: false });
    expect(npmSpy).toHaveBeenCalledTimes(0);
  });

  it('packs package', async () => {
    fs.writeJSONSync(tempPackageJsonPath, testPackage, { spaces: 2 });

    const packResult = await packPackage(getTestPackageInfo(), { packToPath: tempPackPath });
    expect(packResult).toEqual({ success: true, packFile: testPackName });
    expect(npmSpy).toHaveBeenCalledTimes(1);
    expect(npmSpy).toHaveBeenCalledWith(['pack', '--loglevel', 'warn'], expect.objectContaining({ cwd: tempRoot }));
    // file is moved to correct location (not the package folder)
    expect(fs.existsSync(path.join(tempPackPath, testPackName))).toBe(true);
    expect(fs.existsSync(path.join(tempRoot, testPackName))).toBe(false);

    const allLogs = logs.getMockLines('all');
    expect(allLogs).toMatch(`Packing - ${testSpec}`);
    expect(allLogs).toMatch(`Packed ${testSpec} to ${path.join(tempPackPath, testPackName)}`);
  });

  it('handles failure packing', async () => {
    // It's difficult to simulate actual error conditions, so mock an npm call failure.
    npmSpy.mockImplementation(() =>
      Promise.resolve({ success: false, stdout: 'oh no', all: 'oh no' } as npmModule.NpmResult)
    );

    const packResult = await packPackage(getTestPackageInfo(), { packToPath: tempPackPath });
    expect(packResult).toEqual({ success: false });
    expect(npmSpy).toHaveBeenCalledTimes(1);
    expect(fs.existsSync(path.join(tempRoot, testPackName))).toBe(false);
    expect(fs.existsSync(path.join(tempPackPath, testPackName))).toBe(false);

    const allLogs = logs.getMockLines('all');
    expect(allLogs).toMatch(`Packing - ${testSpec}`);
    expect(allLogs).toMatch(`Packing ${testSpec} failed (see above for details)`);
  });

  it('handles if filename is missing from output', async () => {
    npmSpy.mockImplementation(() =>
      Promise.resolve({ success: true, stdout: 'not a file', all: 'not a file' } as npmModule.NpmResult)
    );

    const packResult = await packPackage(getTestPackageInfo(), { packToPath: tempPackPath });
    expect(packResult).toEqual({ success: false });
    expect(npmSpy).toHaveBeenCalledTimes(1);
    expect(fs.existsSync(path.join(tempRoot, testPackName))).toBe(false);
    expect(fs.existsSync(path.join(tempPackPath, testPackName))).toBe(false);

    const allLogs = logs.getMockLines('all');
    expect(allLogs).toMatch(`Packing - ${testSpec}`);
    expect(allLogs).toMatch(`npm pack output for ${testSpec} (above) did not end with a filename that exists`);
  });

  it('handles if filename in output does not exist', async () => {
    npmSpy.mockImplementation(() =>
      Promise.resolve({ success: true, stdout: 'nope.tgz', all: 'nope.tgz' } as npmModule.NpmResult)
    );

    const packResult = await packPackage(getTestPackageInfo(), { packToPath: tempPackPath });
    expect(packResult).toEqual({ success: false });
    expect(npmSpy).toHaveBeenCalledTimes(1);
    expect(fs.existsSync(path.join(tempRoot, testPackName))).toBe(false);
    expect(fs.existsSync(path.join(tempPackPath, testPackName))).toBe(false);

    const allLogs = logs.getMockLines('all');
    expect(allLogs).toMatch(`Packing - ${testSpec}`);
    expect(allLogs).toMatch(`npm pack output for ${testSpec} (above) did not end with a filename that exists`);
  });

  it('handles failure moving file', async () => {
    // mock the npm call to just write a fake .tgz file (since calling npm is slow)
    npmSpy.mockImplementation(() => {
      fs.writeFileSync(path.join(tempRoot, testPackName), 'some content');
      return Promise.resolve({ success: true, stdout: testPackName, all: testPackName } as npmModule.NpmResult);
    });
    // create a file with the same name to simulate a move failure
    fs.writeFileSync(path.join(tempPackPath, testPackName), 'other content');

    const packResult = await packPackage(getTestPackageInfo(), { packToPath: tempPackPath });
    expect(packResult).toEqual({ success: false });
    expect(npmSpy).toHaveBeenCalledTimes(1);

    const allLogs = logs.getMockLines('all');
    expect(allLogs).toMatch(`Packing - ${testSpec}`);
    expect(allLogs).toMatch(
      `Failed to move ${path.join(tempRoot, testPackName)} to ${path.join(tempPackPath, testPackName)}: Error:`
    );

    // tgz file is cleaned up
    expect(fs.existsSync(path.join(tempRoot, testPackName))).toBe(false);
  });
});
