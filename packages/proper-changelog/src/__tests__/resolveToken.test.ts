import { describe, it, expect, jest, beforeEach } from '@jest/globals';

type SpawnFn = (file: string, args: string[]) => Promise<{ stdout: string }>;
const mockSpawn = jest.fn<SpawnFn>();
jest.unstable_mockModule('nano-spawn', () => ({
  default: mockSpawn,
}));

const { resolveToken } = await import('../resolveToken.ts');

describe('resolveToken', () => {
  /** Configure the mocked spawn to succeed with the given stdout. */
  function mockGhSuccess(stdout: string): void {
    mockSpawn.mockResolvedValue({ stdout });
  }

  /** Configure the mocked spawn to fail (e.g. gh not installed). */
  function mockGhFailure(): void {
    mockSpawn.mockRejectedValue(new Error('gh: command not found'));
  }

  beforeEach(() => {
    mockSpawn.mockReset();
  });

  it('returns the explicit token without consulting env or gh', async () => {
    expect(await resolveToken('explicit', { GITHUB_TOKEN: 'env-token' })).toBe('explicit');
    expect(mockSpawn).not.toHaveBeenCalled();
  });

  it('falls back to GITHUB_TOKEN', async () => {
    expect(await resolveToken(undefined, { GITHUB_TOKEN: 'env-token' })).toBe('env-token');
    expect(mockSpawn).not.toHaveBeenCalled();
  });

  it('falls back to GH_TOKEN when GITHUB_TOKEN is absent', async () => {
    expect(await resolveToken(undefined, { GH_TOKEN: 'gh-env-token' })).toBe('gh-env-token');
  });

  it('falls back to `gh auth token` when no env token is set', async () => {
    mockGhSuccess('gh-cli-token\n');
    expect(await resolveToken(undefined, {})).toBe('gh-cli-token');
    expect(mockSpawn).toHaveBeenCalledWith('gh', ['auth', 'token']);
  });

  it('returns undefined when gh is unavailable', async () => {
    mockGhFailure();
    expect(await resolveToken(undefined, {})).toBeUndefined();
  });

  it('returns undefined when gh outputs an empty token', async () => {
    mockGhSuccess('   \n');
    expect(await resolveToken(undefined, {})).toBeUndefined();
  });
});
