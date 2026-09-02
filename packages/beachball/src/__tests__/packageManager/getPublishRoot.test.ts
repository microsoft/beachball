import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import { getDefaultOptions } from '../../options/getDefaultOptions';
import { getPublishRoot } from '../../packageManager/getPublishRoot';
import type { BeachballOptions } from '../../types/BeachballOptions';
import type { PackageInfo } from '../../types/PackageInfo';
import { expectErrorSync } from '@microsoft/beachball-test-utilities';
import { BeachballError } from '../../types/BeachballError';

jest.mock('node:fs');

const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;

describe('getPublishRoot', () => {
  const packageRoot = path.resolve('repo/packages/test-package');
  const packageInfo: PackageInfo = {
    name: 'test-package',
    version: '1.0.0',
    packageJsonPath: path.join(packageRoot, 'package.json'),
  };

  beforeEach(() => {
    mockExistsSync.mockReset();
    mockExistsSync.mockReturnValue(true);
  });

  function getOptions(publishRoot?: BeachballOptions['publishRoot']): BeachballOptions {
    return { ...getDefaultOptions(), publishRoot };
  }

  it('returns the package root by default', () => {
    expect(getPublishRoot(packageInfo, getOptions())).toBe(packageRoot);
  });

  it('resolves a string from the package root', () => {
    expect(getPublishRoot(packageInfo, getOptions('dist'))).toBe(path.join(packageRoot, 'dist'));
  });

  it('resolves a relative function result from the package root and passes context', () => {
    const publishRoot = jest.fn<NonNullable<Exclude<BeachballOptions['publishRoot'], string>>>(() => 'dist');
    const options = getOptions(publishRoot);

    expect(getPublishRoot(packageInfo, options)).toBe(path.join(packageRoot, 'dist'));
    expect(publishRoot).toHaveBeenCalledWith({ packageRoot: packageRoot, options });
  });

  it('uses an absolute function result', () => {
    const absoluteRoot = path.resolve('artifacts/test-package');
    const publishRoot = jest.fn<NonNullable<Exclude<BeachballOptions['publishRoot'], string>>>(() => absoluteRoot);

    expect(getPublishRoot(packageInfo, getOptions(publishRoot))).toBe(absoluteRoot);
  });

  it('throws if package.json at the path does not exist', () => {
    mockExistsSync.mockReturnValue(false);
    expectErrorSync(
      () => getPublishRoot(packageInfo, getOptions('dist')),
      BeachballError,
      `publishRoot does not have package.json: ${path.join(packageRoot, 'dist')}`
    );
  });
});
