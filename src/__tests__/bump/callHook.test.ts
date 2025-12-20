import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { callHook } from '../../bump/callHook';
import { makePackageInfos } from '../../__fixtures__/packageInfos';
import type { HooksOptions } from '../../types/BeachballOptions';
import path from 'path';

type AnyHook = NonNullable<HooksOptions['postbump']>;

const root = path.resolve('/fake/root');

describe('callHook', () => {
  const packageInfos = makePackageInfos(
    {
      // This graph only has one possible ordering
      pkg1: { dependencies: { pkg2: '*' } },
      pkg2: { version: '2.0.0', peerDependencies: { pkg3: '*', pkg4: '*' } },
      pkg3: { devDependencies: { pkg4: '*' } },
      pkg4: { optionalDependencies: { pkg5: '*' } },
      pkg5: {},
    },
    undefined,
    { path: root }
  );

  /** Get hook calls without the final `packageInfos` param for simpler diffs */
  function getHookCalls(hook: jest.Mock<AnyHook>) {
    return hook.mock.calls.map(call => call.slice(0, 3));
  }

  /** Get package names from the list of hook calls */
  function getHookCallNames(hook: jest.Mock<AnyHook>) {
    return hook.mock.calls.map(call => call[1]);
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does nothing if hook is undefined', async () => {
    await callHook(undefined, ['pkg1'], packageInfos, 1);
  });

  it('does nothing if no affected packages', async () => {
    const mockHook = jest.fn<AnyHook>();
    await callHook(mockHook, [], packageInfos, 1);
    expect(mockHook).not.toHaveBeenCalled();
  });

  // Currently there's no topological ordering for non-concurrent hooks
  // (might make sense to either add here or remove for concurrent hooks)
  it('calls hook for each affected package in order with concurrency=1', async () => {
    const mockHook = jest.fn<AnyHook>();

    await callHook(mockHook, ['pkg3', 'pkg2', 'pkg5'], packageInfos, 1);

    // Verify the exact args of one call
    expect(mockHook).toHaveBeenCalledWith(path.join(root, 'packages/pkg2'), 'pkg2', '2.0.0', packageInfos);

    // Most of the tests omit the very large final packageInfos arg for better diffs on error
    expect(getHookCalls(mockHook)).toEqual([
      [expect.stringMatching(/pkg3$/), 'pkg3', '1.0.0'],
      [expect.stringMatching(/pkg2$/), 'pkg2', '2.0.0'],
      [expect.stringMatching(/pkg5$/), 'pkg5', '1.0.0'],
    ]);
  });

  it('works with set of affected packages', async () => {
    const mockHook = jest.fn<AnyHook>();

    await callHook(mockHook, new Set(['pkg3', 'pkg2']), packageInfos, 1);

    expect(getHookCallNames(mockHook)).toEqual(['pkg3', 'pkg2']);
  });

  // really should have been validated already
  it('ignores nonexistent package with concurrency=1', async () => {
    const mockHook = jest.fn<AnyHook>();

    await callHook(mockHook, ['pkg1', 'nonexistent', 'pkg4'], packageInfos, 1);
    expect(mockHook).toHaveBeenCalledTimes(2);
  });

  it('calls hook sequentially when concurrency=1', async () => {
    const callOrder: string[] = [];
    const mockHook = jest.fn<AnyHook>(async (_, name) => {
      callOrder.push(`start-${name}`);
      await new Promise(resolve => setTimeout(resolve, 20));
      callOrder.push(`end-${name}`);
    });

    await callHook(mockHook, ['pkg1', 'pkg2'], packageInfos, 1);

    // With concurrency=1, should be fully sequential
    expect(callOrder).toEqual(['start-pkg1', 'end-pkg1', 'start-pkg2', 'end-pkg2']);
  });

  // sync/async shouldn't be any different here
  it('propagates sync hook errors with concurrency=1', async () => {
    const mockHook = jest.fn<AnyHook>((_, name) => {
      if (name === 'pkg2') throw new Error('oh no');
    });

    await expect(() => callHook(mockHook, ['pkg1', 'pkg2', 'pkg3'], packageInfos, 1)).rejects.toThrow('oh no');
    // failed on second call, does not continue
    expect(mockHook).toHaveBeenCalledTimes(2);
  });

  it('propagates async hook errors with concurrency=1', async () => {
    const mockHook = jest.fn<AnyHook>(async (_, name) => {
      if (name === 'pkg2') {
        await new Promise(resolve => setTimeout(resolve, 0));
        throw new Error('async oh no');
      }
    });

    await expect(() => callHook(mockHook, ['pkg1', 'pkg2', 'pkg3'], packageInfos, 1)).rejects.toThrow('async oh no');
    expect(mockHook).toHaveBeenCalledTimes(2);
  });

  it('calls hook with concurrency > 1 in topological order', async () => {
    const mockHook = jest.fn<AnyHook>();

    await callHook(mockHook, ['pkg1', 'pkg5', 'pkg4', 'pkg2', 'pkg3'], packageInfos, 2);

    expect(getHookCallNames(mockHook)).toEqual(['pkg5', 'pkg4', 'pkg3', 'pkg2', 'pkg1']);
  });

  it('ignores nonexistent packages with concurrency > 1', async () => {
    const mockHook = jest.fn<AnyHook>();

    await callHook(mockHook, ['pkg1', 'nonexistent', 'pkg2'], packageInfos, 3);

    expect(getHookCallNames(mockHook)).toEqual(['pkg2', 'pkg1']);
  });

  it('calls hook for each affected package in order and respecting max concurrency', async () => {
    const callOrder: string[] = [];
    let currentConcurrency = 0;
    let maxConcurrency = 0;
    const mockHook = jest.fn<AnyHook>(async (_, name) => {
      callOrder.push(`start-${name}`);
      currentConcurrency++;
      maxConcurrency = Math.max(maxConcurrency, currentConcurrency);
      await new Promise(resolve => setTimeout(resolve, 20));
      currentConcurrency--;
      callOrder.push(`end-${name}`);
    });

    await callHook(mockHook, ['pkg1', 'pkg2', 'pkg3', 'pkg4', 'pkg5'], packageInfos, 3);

    expect(maxConcurrency).toBeLessThanOrEqual(3);

    // Verify that dependencies are still respected in the call order
    const pkg3Start = callOrder.indexOf('start-pkg3');
    const pkg2Start = callOrder.indexOf('start-pkg2');
    const pkg1Start = callOrder.indexOf('start-pkg1');
    expect(pkg3Start).toBeLessThan(pkg2Start);
    expect(pkg2Start).toBeLessThan(pkg1Start);
  });

  // this shouldn't be any different sync/async, but just in case...
  it('propagates sync hook errors with concurrency > 1', async () => {
    const mockHook = jest.fn<AnyHook>((_, name) => {
      if (name === 'pkg2') {
        throw new Error('oh no');
      }
    });

    // this will be in topological order so pkg2 is the third call
    await expect(() => callHook(mockHook, ['pkg1', 'pkg2', 'pkg3', 'pkg4'], packageInfos, 2)).rejects.toThrow('oh no');
    // stops as soon as error is encountered
    expect(mockHook).toHaveBeenCalledTimes(3);
  });

  it('propagates async hook errors with concurrency > 1', async () => {
    const mockHook = jest.fn<AnyHook>(async (_, name) => {
      if (name === 'pkg2') {
        await new Promise(resolve => setTimeout(resolve, 0));
        throw new Error('oh no');
      }
    });

    // this will be in topological order so pkg2 is the third call
    await expect(() => callHook(mockHook, ['pkg1', 'pkg2', 'pkg3', 'pkg4'], packageInfos, 2)).rejects.toThrow('oh no');
    // stops as soon as error is encountered
    expect(mockHook).toHaveBeenCalledTimes(3);
  });
});
