import { describe, it, expect, jest, afterAll, afterEach, beforeAll, beforeEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { updateLockFile } from '../../bump/updateLockFile';
import { packageManager, type PackageManagerResult } from '../../packageManager/packageManager';

jest.mock('fs');
jest.mock('../../packageManager/packageManager');
jest.mock('../../env', () => ({
  env: {
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    ...jest.requireActual<typeof import('../../env')>('../../env').env,
    isJest: false,
  },
}));

describe('updateLockFile', () => {
  const mockRoot = path.resolve('/mock/root');
  const mockFs = fs as jest.Mocked<typeof fs>;
  const mockPackageManager = packageManager as jest.MockedFunction<typeof packageManager>;
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
  let consoleWarnSpy: jest.SpiedFunction<typeof console.warn>;

  beforeAll(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  beforeEach(() => {
    mockPackageManager.mockResolvedValue({ success: true } as PackageManagerResult);
    mockFs.existsSync.mockReturnValue(false);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('updates package-lock.json when it exists', async () => {
    mockFs.existsSync.mockImplementation(p => p === path.join(mockRoot, 'package-lock.json'));

    await updateLockFile({ path: mockRoot });

    expect(consoleLogSpy).toHaveBeenCalledWith('Updating package-lock.json after bumping packages');
    expect(mockPackageManager).toHaveBeenCalledWith('npm', ['install', '--package-lock-only', '--ignore-scripts'], {
      stdio: 'inherit',
      cwd: mockRoot,
    });
  });

  it('updates pnpm-lock.yaml when it exists', async () => {
    mockFs.existsSync.mockImplementation(p => p === path.join(mockRoot, 'pnpm-lock.yaml'));

    await updateLockFile({ path: mockRoot });

    expect(consoleLogSpy).toHaveBeenCalledWith('Updating pnpm-lock.yaml after bumping packages');
    expect(mockPackageManager).toHaveBeenCalledWith('pnpm', ['install', '--lockfile-only', '--ignore-scripts'], {
      stdio: 'inherit',
      cwd: mockRoot,
    });
  });

  it('updates yarn.lock for yarn v2+', async () => {
    mockFs.existsSync.mockImplementation(p => p === path.join(mockRoot, 'yarn.lock'));
    mockPackageManager.mockResolvedValueOnce({ success: true, stdout: '3.6.0' } as PackageManagerResult);
    mockPackageManager.mockResolvedValueOnce({ success: true } as PackageManagerResult);

    await updateLockFile({ path: mockRoot });

    expect(mockPackageManager).toHaveBeenCalledTimes(2);
    expect(mockPackageManager).toHaveBeenCalledWith('yarn', ['--version'], { cwd: mockRoot });
    expect(mockPackageManager).toHaveBeenCalledWith('yarn', ['install', '--mode', 'update-lockfile'], {
      stdio: 'inherit',
      cwd: mockRoot,
    });
    expect(consoleLogSpy).toHaveBeenCalledWith('Updating yarn.lock after bumping packages');
  });

  it('skips yarn.lock update for yarn v1', async () => {
    mockFs.existsSync.mockImplementation(p => p === path.join(mockRoot, 'yarn.lock'));
    mockPackageManager.mockResolvedValue({ success: true, stdout: '1.22.19' } as PackageManagerResult);

    await updateLockFile({ path: mockRoot });

    expect(mockPackageManager).toHaveBeenCalledWith('yarn', ['--version'], { cwd: mockRoot });
    expect(mockPackageManager).toHaveBeenCalledTimes(1);
    expect(consoleLogSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  it('warns when yarn version check fails', async () => {
    mockFs.existsSync.mockImplementation(p => p === path.join(mockRoot, 'yarn.lock'));
    mockPackageManager.mockResolvedValue({ success: false, stdout: '', stderr: 'error' } as PackageManagerResult);

    await updateLockFile({ path: mockRoot });

    expect(consoleWarnSpy).toHaveBeenCalledWith('Failed to get yarn version. Continuing...');
  });

  it('warns when lock file update fails', async () => {
    mockFs.existsSync.mockImplementation(p => p === path.join(mockRoot, 'package-lock.json'));
    mockPackageManager.mockResolvedValue({ success: false, stdout: '', stderr: 'error' } as PackageManagerResult);

    await updateLockFile({ path: mockRoot });

    expect(consoleWarnSpy).toHaveBeenCalledWith('Updating package-lock.json failed. Continuing...');
  });

  it('does nothing when no lock file exists', async () => {
    mockFs.existsSync.mockReturnValue(false);

    await updateLockFile({ path: mockRoot });

    expect(mockPackageManager).not.toHaveBeenCalled();
    expect(consoleLogSpy).not.toHaveBeenCalled();
  });
});
