import { jest, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import fs from 'fs';
import { updatePackageJsons } from '../../bump/updatePackageJsons';
import { makePackageInfos } from '../../__fixtures__/packageInfos';
import { consideredDependencies, PackageJson, type PackageInfo } from '../../types/PackageInfo';
import * as readJsonModule from '../../object/readJson';
import * as writeJsonModule from '../../object/writeJson';

jest.mock('fs');
jest.mock('../../object/readJson');
jest.mock('../../object/writeJson');

describe('updatePackageJsons', () => {
  const mockFs = fs as jest.Mocked<typeof fs>;
  const mockReadJson = readJsonModule as jest.Mocked<typeof readJsonModule>;
  const mockWriteJson = writeJsonModule as jest.Mocked<typeof writeJsonModule>;
  let consoleWarnSpy: jest.SpiedFunction<typeof console.warn>;

  /**
   * Get `writeJson` args for a package, with beachball-specific and undefined keys removed.
   */
  function getWriteJsonArgs(packageInfo: PackageInfo): Parameters<typeof writeJsonModule.writeJson> {
    const { packageJsonPath, combinedOptions: _a, packageOptions: _b, ...json } = packageInfo;
    // Parse/stringify as a shortcut to remove undefined keys
    const cleanedJson = JSON.parse(JSON.stringify(json)) as PackageJson;
    if (cleanedJson.private === false) {
      delete cleanedJson.private;
    }
    return [packageJsonPath, cleanedJson];
  }

  beforeAll(() => {
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockFs.existsSync.mockReturnValue(true);
    mockReadJson.readJson.mockImplementation(() => {
      throw new Error('Unexpected readJson call');
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('updates version for non-private packages', () => {
    const modifiedPackages = new Set(['pkg-a']);
    const packageInfos = makePackageInfos({
      'pkg-a': { version: '2.0.0' },
    });
    mockReadJson.readJson.mockReturnValueOnce({ name: 'pkg-a', version: '1.0.0' });

    updatePackageJsons(modifiedPackages, packageInfos);

    expect(mockWriteJson.writeJson).toHaveBeenCalledTimes(1);
    expect(mockWriteJson.writeJson).toHaveBeenCalledWith(...getWriteJsonArgs(packageInfos['pkg-a']));
  });

  it('does not update version for private packages', () => {
    const modifiedPackages = new Set(['pkg-private']);
    const packageInfos = makePackageInfos({
      // beachball shouldn't have changed this, but verify just in case
      'pkg-private': { version: '2.0.0', private: true },
    });
    mockReadJson.readJson.mockReturnValueOnce({ name: 'pkg-private', version: '1.0.0', private: true });

    updatePackageJsons(modifiedPackages, packageInfos);

    // old version is preserved
    expect(mockWriteJson.writeJson).toHaveBeenCalledWith(
      ...getWriteJsonArgs({ ...packageInfos['pkg-private'], version: '1.0.0' })
    );
  });

  it('skips packages with nonexistent package.json', () => {
    const modifiedPackages = new Set(['pkg-a']);
    const packageInfos = makePackageInfos({
      'pkg-a': { version: '2.0.0' },
    });

    mockFs.existsSync.mockReturnValue(false);

    updatePackageJsons(modifiedPackages, packageInfos);

    expect(consoleWarnSpy).toHaveBeenCalledWith('Skipping pkg-a since package.json does not exist');
    expect(mockReadJson.readJson).not.toHaveBeenCalled();
    expect(mockWriteJson.writeJson).not.toHaveBeenCalled();
  });

  it.each(consideredDependencies)('updates %s for modified packages', depType => {
    const modifiedPackages = new Set(['pkg-a', 'pkg-b']);
    const packageInfos = makePackageInfos({
      'pkg-a': { version: '2.0.0', [depType]: { 'pkg-b': '^2.0.0' } },
      'pkg-b': { version: '2.0.0' },
    });

    mockReadJson.readJson.mockReturnValueOnce({ name: 'pkg-a', version: '1.0.0', [depType]: { 'pkg-b': '^1.0.0' } });
    mockReadJson.readJson.mockReturnValueOnce({ name: 'pkg-b', version: '1.0.0' });

    updatePackageJsons(modifiedPackages, packageInfos);

    expect(mockWriteJson.writeJson).toHaveBeenCalledTimes(2);
    expect(mockWriteJson.writeJson).toHaveBeenNthCalledWith(1, ...getWriteJsonArgs(packageInfos['pkg-a']));
    expect(mockWriteJson.writeJson).toHaveBeenNthCalledWith(2, ...getWriteJsonArgs(packageInfos['pkg-b']));
  });

  it('does not update dependencies on unmodified packages', () => {
    const modifiedPackages = new Set(['pkg-a']);
    const packageInfos = makePackageInfos({
      'pkg-a': { version: '2.0.0', dependencies: { 'pkg-b': '^1.0.0' } },
      // pkg-b was 1.0.0 when the bump started and was not modified
      'pkg-b': { version: '1.0.0' },
    });

    // Suppose pkg-b was modified manually in the meantime by another PR
    mockReadJson.readJson.mockReturnValueOnce({ name: 'pkg-a', version: '1.0.0', dependencies: { 'pkg-b': '^2.0.0' } });

    updatePackageJsons(modifiedPackages, packageInfos);

    // the new pkg-b dep is preserved
    expect(mockWriteJson.writeJson).toHaveBeenCalledWith(
      ...getWriteJsonArgs({ ...packageInfos['pkg-a'], dependencies: { 'pkg-b': '^2.0.0' } })
    );
  });

  it('handles multiple dependency types', () => {
    const modifiedPackages = new Set(['pkg-a', 'pkg-b', 'pkg-c']);
    const packageInfos = makePackageInfos({
      'pkg-a': {
        version: '2.0.0',
        dependencies: { 'pkg-b': '^2.0.0', other: '^1.0.0' },
        devDependencies: { 'pkg-c': '^2.0.0' },
      },
      'pkg-b': { version: '2.0.0' },
      'pkg-c': { version: '2.0.0' },
      other: {},
    });

    mockReadJson.readJson.mockReturnValueOnce({
      name: 'pkg-a',
      version: '1.0.0',
      dependencies: { 'pkg-b': '^1.0.0', other: '^1.0.0' },
      devDependencies: { 'pkg-c': '^1.0.0' },
    });
    mockReadJson.readJson.mockReturnValueOnce({ name: 'pkg-b', version: '1.0.0' });
    mockReadJson.readJson.mockReturnValueOnce({ name: 'pkg-c', version: '1.0.0' });

    updatePackageJsons(modifiedPackages, packageInfos);

    expect(mockWriteJson.writeJson).toHaveBeenCalledTimes(3);
    expect(mockWriteJson.writeJson).toHaveBeenNthCalledWith(1, ...getWriteJsonArgs(packageInfos['pkg-a']));
    expect(mockWriteJson.writeJson).toHaveBeenNthCalledWith(2, ...getWriteJsonArgs(packageInfos['pkg-b']));
    expect(mockWriteJson.writeJson).toHaveBeenNthCalledWith(3, ...getWriteJsonArgs(packageInfos['pkg-c']));
  });
});
