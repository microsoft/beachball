import { describe, it, expect, jest, afterEach, beforeEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { updateLockFile } from '../../bump/updateLockFile';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import { spawn, type SpawnResult } from '../../process/spawn';

// Preserve old alias
type PackageManagerResult = SpawnResult;

jest.mock('fs');
jest.mock('../../process/spawn');
jest.mock('../../env', () => ({
  env: {
    ...jest.requireActual<typeof import('../../env')>('../../env').env,
    isJest: false,
  },
}));

describe('updateLockFile', () => {
  const logs = initMockLogs({ alsoLog: ['error'] });
  const mockRoot = path.resolve('/mock/root');
  const mockFs = fs as jest.Mocked<typeof fs>;
  const mockPackageManager = spawn as jest.MockedFunction<typeof spawn>;

  beforeEach(() => {
    mockPackageManager.mockResolvedValue({ success: true } as PackageManagerResult);
    mockFs.existsSync.mockReturnValue(false);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('updates package-lock.json when it exists', async () => {
    mockFs.existsSync.mockImplementation(p => p === path.join(mockRoot, 'package-lock.json'));

    await updateLockFile({ path: mockRoot });

    expect(logs.mocks.log).toHaveBeenCalledWith('Updating package-lock.json after bumping packages');
    expect(mockPackageManager).toHaveBeenCalledWith('npm', ['install', '--package-lock-only', '--ignore-scripts'], {
      stdio: 'inherit',
      cwd: mockRoot,
    });
  });

  it('updates pnpm-lock.yaml when it exists', async () => {
    mockFs.existsSync.mockImplementation(p => p === path.join(mockRoot, 'pnpm-lock.yaml'));

    await updateLockFile({ path: mockRoot });

    expect(logs.mocks.log).toHaveBeenCalledWith('Updating pnpm-lock.yaml after bumping packages');
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
    expect(logs.mocks.log).toHaveBeenCalledWith('Updating yarn.lock after bumping packages');
  });

  it('skips yarn.lock update for yarn v1', async () => {
    mockFs.existsSync.mockImplementation(p => p === path.join(mockRoot, 'yarn.lock'));
    mockPackageManager.mockResolvedValue({ success: true, stdout: '1.22.19' } as PackageManagerResult);

    await updateLockFile({ path: mockRoot });

    expect(mockPackageManager).toHaveBeenCalledWith('yarn', ['--version'], { cwd: mockRoot });
    expect(mockPackageManager).toHaveBeenCalledTimes(1);
    expect(logs.mocks.log).not.toHaveBeenCalled();
    expect(logs.mocks.warn).not.toHaveBeenCalled();
  });

  it('warns when yarn version check fails', async () => {
    mockFs.existsSync.mockImplementation(p => p === path.join(mockRoot, 'yarn.lock'));
    mockPackageManager.mockResolvedValue({ success: false, stdout: '', stderr: 'error' } as PackageManagerResult);

    await updateLockFile({ path: mockRoot });

    expect(logs.mocks.warn).toHaveBeenCalledWith('Failed to get yarn version. Continuing...');
  });

  it('warns when lock file update fails', async () => {
    mockFs.existsSync.mockImplementation(p => p === path.join(mockRoot, 'package-lock.json'));
    mockPackageManager.mockResolvedValue({ success: false, stdout: '', stderr: 'error' } as PackageManagerResult);

    await updateLockFile({ path: mockRoot });

    expect(logs.mocks.warn).toHaveBeenCalledWith('Updating package-lock.json failed. Continuing...');
  });

  it('does nothing when no lock file exists', async () => {
    mockFs.existsSync.mockReturnValue(false);

    await updateLockFile({ path: mockRoot });

    expect(mockPackageManager).not.toHaveBeenCalled();
    expect(logs.mocks.log).not.toHaveBeenCalled();
  });
});
