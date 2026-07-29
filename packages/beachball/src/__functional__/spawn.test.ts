import { describe, expect, it } from '@jest/globals';
import { spawn, type SpawnFailureResult } from '../spawn';

describe('spawn', () => {
  it('resolves with a success result for a successful command', async () => {
    const result = await spawn('node', ['-e', `process.stdout.write('hello world')`]);
    expect(result).toMatchObject({
      success: true,
      stdout: 'hello world',
      // stringContaining only matters in the debugger
      output: expect.stringContaining('hello world'),
    });
    expect((result as SpawnFailureResult).exitCode).toBeUndefined();
  });

  it('returns a failure result (does not throw) for a non-zero exit code', async () => {
    const result = await spawn('node', ['-e', `process.stderr.write('oh no'); process.exit(3)`]);
    expect(result).toMatchObject({
      success: false,
      name: 'SubprocessError', // checking instanceof would require async importing SubprocessError
      exitCode: 3,
      stderr: expect.stringContaining('oh no'),
      output: expect.stringContaining('oh no'),
      timedOut: undefined,
    });
    // message can't be checked in toMatchObject since it's not enumerable
    expect((result as SpawnFailureResult).message).toContain('Command failed');
  });

  // this indirectly tests an assumption in signWithAzureCli
  it('returns a failure result with an ENOENT cause for a missing binary', async () => {
    const result = await spawn('beachball-nonexistent-binary-xyz', [], { env: { PATH: '' } });
    expect(result.success).toBe(false);
    const failure = result as SpawnFailureResult;
    if (process.platform === 'win32') {
      expect((failure.cause as NodeJS.ErrnoException | undefined)?.message).toContain('ENOENT');
    } else {
      // nano-spawn wraps the original spawn error as `cause`, so the code lives there.
      expect((failure.cause as NodeJS.ErrnoException | undefined)?.code).toBe('ENOENT');
    }
  });

  it('passes the env option, merged with process.env', async () => {
    const result = await spawn(
      'node',
      ['-e', `process.stdout.write(process.env.BEACHBALL_TEST_VAR + '|' + Boolean(process.env.PATH))`],
      { env: { BEACHBALL_TEST_VAR: 'custom-value' } }
    );
    expect(result).toMatchObject({ success: true, stdout: 'custom-value|true' });
  });

  it('sets timedOut when the timeout is exceeded', async () => {
    const result = await spawn('node', ['-e', 'setTimeout(() => {}, 10000)'], { timeout: 20 });
    expect(result).toMatchObject({ success: false, timedOut: true });
  });

  it('throws when both timeout and signal are specified', async () => {
    const controller = new AbortController();
    await expect(spawn('node', ['-e', ''], { timeout: 100, signal: controller.signal })).rejects.toThrow(
      'Cannot specify both timeout and signal'
    );
  });
});
