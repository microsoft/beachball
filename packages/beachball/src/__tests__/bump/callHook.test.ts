import { describe, expect, it, jest } from '@jest/globals';
import path from 'path';
import { makePackageInfos } from '../../__fixtures__/packageInfos';
import { callHook } from '../../bump/callHook';
import { getPackageGraph } from '../../monorepo/getPackageGraph';
import type { HooksOptions } from '../../types/BeachballOptions';

type PostbumpHook = NonNullable<HooksOptions['postbump']>;
type PrebumpHook = NonNullable<HooksOptions['prebump']>;

const root = path.resolve('/fake/root');

describe('callHook', () => {
  const packageInfos = makePackageInfos(
    {
      // This graph only has one possible ordering
      pkg1: { dependencies: { pkg2: '*' } },
      pkg2: { version: '2.0.0', peerDependencies: { pkg3: '*', pkg4: '*' } },
      pkg3: { dependencies: { pkg4: '*' } },
      pkg4: { optionalDependencies: { pkg5: '*' } },
      pkg5: {},
    },
    { path: root }
  );

  /** Get package names from the list of hook calls */
  function getHookCallNames(hook: jest.Mock<PostbumpHook>) {
    return hook.mock.calls.map(call => call[1]);
  }

  it('does nothing if hook is undefined', async () => {
    const graph = getPackageGraph(['pkg1'], packageInfos);
    const runSpy = jest.spyOn(graph, 'run');
    await callHook('postbump', graph, packageInfos, { concurrency: 1 });
    expect(runSpy).not.toHaveBeenCalled();
  });

  it('does nothing if packageGraph is undefined', async () => {
    const mockHook = jest.fn<PostbumpHook>();
    await callHook('postbump', undefined, packageInfos, { hooks: { postbump: mockHook }, concurrency: 1 });
    expect(mockHook).not.toHaveBeenCalled();
  });

  it('does nothing if no affected packages', async () => {
    const mockHook = jest.fn<PostbumpHook>();
    const graph = getPackageGraph([], packageInfos);
    await callHook('postbump', graph, packageInfos, { hooks: { postbump: mockHook }, concurrency: 1 });
    expect(mockHook).not.toHaveBeenCalled();
  });

  // Currently there's no topological ordering for non-concurrent hooks
  // (might make sense to either add here or remove for concurrent hooks)
  it('calls hook for each affected package in order with concurrency=1', async () => {
    const mockHook = jest.fn<PostbumpHook>();
    const graph = getPackageGraph(['pkg2', 'pkg4', 'pkg5'], packageInfos);
    await callHook('postbump', graph, packageInfos, { hooks: { postbump: mockHook }, concurrency: 1 });

    // Verify the exact args of one call
    expect(mockHook).toHaveBeenCalledWith(path.join(root, 'packages/pkg2'), 'pkg2', '2.0.0', packageInfos);

    expect(getHookCallNames(mockHook)).toEqual(['pkg5', 'pkg4', 'pkg2']);
    // Most of the tests omit the very large final packageInfos arg for better diffs on error,
    // but test it here once
    expect(mockHook.mock.calls).toEqual([
      [path.join(root, 'packages/pkg5'), 'pkg5', '1.0.0', packageInfos],
      [path.join(root, 'packages/pkg4'), 'pkg4', '1.0.0', packageInfos],
      [path.join(root, 'packages/pkg2'), 'pkg2', '2.0.0', packageInfos],
    ]);
  });

  it('works with Set of affected packages', async () => {
    const mockHook = jest.fn<PostbumpHook>();
    const graph = getPackageGraph(new Set(['pkg3', 'pkg2']), packageInfos);
    await callHook('postbump', graph, packageInfos, { hooks: { postbump: mockHook }, concurrency: 1 });
    expect(getHookCallNames(mockHook)).toEqual(['pkg3', 'pkg2']);
  });

  it.each(['postbump', 'prepublish', 'postpublish'] as const)('calls %s hook with PackageInfos', async hookName => {
    const mockHook = jest.fn<PostbumpHook>();
    const graph = getPackageGraph(['pkg1'], packageInfos);
    await callHook(hookName, graph, packageInfos, { hooks: { [hookName]: mockHook }, concurrency: 1 });
    expect(mockHook).toHaveBeenCalledTimes(1);
    expect(mockHook).toHaveBeenCalledWith(path.join(root, 'packages/pkg1'), 'pkg1', '1.0.0', packageInfos);
  });

  it('calls prebump hook without PackageInfos', async () => {
    const mockHook = jest.fn<PrebumpHook>();
    const graph = getPackageGraph(['pkg1'], packageInfos);
    await callHook('prebump', graph, packageInfos, { hooks: { prebump: mockHook }, concurrency: 1 });
    expect(mockHook).toHaveBeenCalledTimes(1);
    expect(mockHook).toHaveBeenCalledWith(path.join(root, 'packages/pkg1'), 'pkg1', '1.0.0');
  });

  it('calls hook sequentially when concurrency=1', async () => {
    const callOrder: string[] = [];
    const mockHook = jest.fn<PostbumpHook>(async (_, name) => {
      callOrder.push(`start-${name}`);
      await new Promise(resolve => setTimeout(resolve, 20));
      callOrder.push(`end-${name}`);
    });

    const graph = getPackageGraph(['pkg1', 'pkg2'], packageInfos);
    await callHook('postbump', graph, packageInfos, { hooks: { postbump: mockHook }, concurrency: 1 });

    // With concurrency=1, should be fully sequential
    expect(callOrder).toEqual(['start-pkg2', 'end-pkg2', 'start-pkg1', 'end-pkg1']);
  });

  // sync/async shouldn't be any different here
  it('propagates sync hook errors with concurrency=1', async () => {
    const mockHook = jest.fn<PostbumpHook>((_, name) => {
      if (name === 'pkg2') throw new Error('oh no');
    });

    const graph = getPackageGraph(['pkg1', 'pkg2', 'pkg3'], packageInfos);
    await expect(() =>
      callHook('postbump', graph, packageInfos, { hooks: { postbump: mockHook }, concurrency: 1 })
    ).rejects.toThrow('oh no');
    // failed on second call, does not continue
    expect(mockHook).toHaveBeenCalledTimes(2);
  });

  it('propagates async hook errors with concurrency=1', async () => {
    const mockHook = jest.fn<PostbumpHook>(async (_, name) => {
      if (name === 'pkg2') {
        await new Promise(resolve => setTimeout(resolve, 0));
        throw new Error('async oh no');
      }
    });

    const graph = getPackageGraph(['pkg1', 'pkg2', 'pkg3'], packageInfos);
    await expect(() =>
      callHook('postbump', graph, packageInfos, { hooks: { postbump: mockHook }, concurrency: 1 })
    ).rejects.toThrow('async oh no');
    expect(mockHook).toHaveBeenCalledTimes(2);
  });

  it('calls hook with concurrency > 1 in topological order', async () => {
    const mockHook = jest.fn<PostbumpHook>();

    const graph = getPackageGraph(['pkg1', 'pkg5', 'pkg4', 'pkg2', 'pkg3'], packageInfos);
    await callHook('postbump', graph, packageInfos, {
      hooks: { postbump: mockHook },
      concurrency: 2,
    });

    expect(getHookCallNames(mockHook)).toEqual(['pkg5', 'pkg4', 'pkg3', 'pkg2', 'pkg1']);
  });

  it('calls hook for each affected package in order and respecting max concurrency', async () => {
    const callOrder: string[] = [];
    let currentConcurrency = 0;
    let maxConcurrency = 0;
    const mockHook = jest.fn<PostbumpHook>(async (_, name) => {
      callOrder.push(`start-${name}`);
      currentConcurrency++;
      maxConcurrency = Math.max(maxConcurrency, currentConcurrency);
      await new Promise(resolve => setTimeout(resolve, 20));
      currentConcurrency--;
      callOrder.push(`end-${name}`);
    });

    const graph = getPackageGraph(['pkg1', 'pkg2', 'pkg3', 'pkg4', 'pkg5'], packageInfos);
    await callHook('postbump', graph, packageInfos, {
      hooks: { postbump: mockHook },
      concurrency: 3,
    });

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
    const mockHook = jest.fn<PostbumpHook>((_, name) => {
      if (name === 'pkg2') {
        throw new Error('oh no');
      }
    });

    // this will be in topological order so pkg2 is the third call
    const graph = getPackageGraph(['pkg1', 'pkg2', 'pkg3', 'pkg4'], packageInfos);
    await expect(() =>
      callHook('postbump', graph, packageInfos, {
        hooks: { postbump: mockHook },
        concurrency: 2,
      })
    ).rejects.toThrow('oh no');
    // stops as soon as error is encountered
    expect(mockHook).toHaveBeenCalledTimes(3);
  });

  it('propagates async hook errors with concurrency > 1', async () => {
    const mockHook = jest.fn<PostbumpHook>(async (_, name) => {
      if (name === 'pkg2') {
        await new Promise(resolve => setTimeout(resolve, 0));
        throw new Error('oh no');
      }
    });

    // this will be in topological order so pkg2 is the third call
    const graph = getPackageGraph(['pkg1', 'pkg2', 'pkg3', 'pkg4'], packageInfos);
    await expect(() =>
      callHook('postbump', graph, packageInfos, {
        hooks: { postbump: mockHook },
        concurrency: 2,
      })
    ).rejects.toThrow('oh no');
    // stops as soon as error is encountered
    expect(mockHook).toHaveBeenCalledTimes(3);
  });
});
