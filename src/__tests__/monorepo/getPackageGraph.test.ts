import { describe, expect, it } from '@jest/globals';
import type { PackageInfo, PackageInfos } from '../../types/PackageInfo';
import { makePackageInfos } from '../../__fixtures__/packageInfos';
import { getPackageGraph } from '../../monorepo/getPackageGraph';

describe('getPackageGraph', () => {
  /**
   * Make a package graph with `affectedPackages` and return the order in which the packages were run.
   */
  async function getPackageGraphPackageNames(
    affectedPackages: Iterable<string>,
    packageInfos: PackageInfos
  ): Promise<string[]> {
    const visitedPackages: string[] = [];
    const packageGraph = getPackageGraph(affectedPackages, packageInfos, async (packageInfo: PackageInfo) => {
      visitedPackages.push(packageInfo.name);
    });
    await packageGraph.run({
      concurrency: 1,
      continue: false,
    });

    return visitedPackages;
  }

  it('sort packages which none of them has dependency', async () => {
    const packageInfos: PackageInfos = makePackageInfos({ foo: {}, bar: {} });

    expect(await getPackageGraphPackageNames(['foo', 'bar'], packageInfos)).toEqual(['foo', 'bar']);
  });

  it('sort packages with dependencies', async () => {
    const packageInfos = makePackageInfos({
      foo: {
        dependencies: { foo3: '1.0.0', bar2: '1.0.0' },
      },
      foo3: { dependencies: { foo2: '1.0.0' } },
      foo2: {},
    });

    const visited = await getPackageGraphPackageNames(['foo', 'foo2', 'foo3'], packageInfos);
    expect(visited).toEqual(['foo2', 'foo3', 'foo']);
  });

  it('sort packages with different kinds of dependencies', async () => {
    const packageInfos = makePackageInfos({
      foo: { dependencies: { foo3: '1.0.0' }, peerDependencies: { foo4: '1.0.0', bar: '1.0.0' } },
      foo2: { dependencies: {} },
      foo3: { dependencies: { foo2: '1.0.0' } },
      foo4: { devDependencies: { foo2: '1.0.0' } },
    });

    const visited = await getPackageGraphPackageNames(['foo', 'foo2', 'foo3', 'foo4'], packageInfos);
    expect(visited).toEqual(['foo2', 'foo3', 'foo4', 'foo']);
  });

  it('sort packages with all different kinds of dependencies', async () => {
    const packageInfos = makePackageInfos({
      foo: { dependencies: { foo3: '1.0.0' }, peerDependencies: { foo4: '1.0.0', bar: '1.0.0' } },
      foo2: { dependencies: {} },
      foo3: { optionalDependencies: { foo2: '1.0.0' } },
      foo4: { devDependencies: { foo2: '1.0.0' } },
    });

    const visited = await getPackageGraphPackageNames(['foo', 'foo2', 'foo3', 'foo4'], packageInfos);
    expect(visited).toEqual(['foo2', 'foo3', 'foo4', 'foo']);
  });

  it('do not sort packages if it is not included', async () => {
    const packageInfos = makePackageInfos({
      foo: { dependencies: { foo3: '1.0.0', bar: '1.0.0' } },
      foo2: {},
      foo3: { dependencies: { foo2: '1.0.0' } },
    });

    const visited = await getPackageGraphPackageNames(['foo', 'foo3'], packageInfos);
    expect(visited).toEqual(['foo3', 'foo']);
  });

  it('do not sort packages if it is not included harder scenario', async () => {
    const packageInfos = makePackageInfos({
      foo: { dependencies: { foo3: '1.0.0', bar: '1.0.0' } },
      foo2: { dependencies: { foo4: '1.0.0' } },
      foo3: { dependencies: { foo2: '1.0.0' } },
      foo4: { dependencies: {} },
      bar: { dependencies: { foo: '1.0.0' } },
    });

    const visited = await getPackageGraphPackageNames(['foo', 'foo3'], packageInfos);
    expect(visited).toEqual(['foo3', 'foo']);
  });

  it('throws if contains circular dependencies inside affected packages', async () => {
    const packageInfos = makePackageInfos({
      foo: { dependencies: { bar: '1.0.0' } },
      bar: { dependencies: { foo: '1.0.0' } },
    });

    await expect(() => getPackageGraphPackageNames(['foo', 'bar'], packageInfos)).rejects.toThrow(
      /We could not find a node in the graph with no dependencies, this likely means there is a cycle including all nodes/
    );
  });

  it('throws if contains circular dependencies', async () => {
    const packageInfos = makePackageInfos({
      foo: { dependencies: { bar: '1.0.0', bar2: '1.0.0' } },
      bar: { dependencies: { foo: '1.0.0' } },
    });

    await expect(() => getPackageGraphPackageNames(['foo', 'bar'], packageInfos)).rejects.toThrow(
      /We could not find a node in the graph with no dependencies, this likely means there is a cycle including all nodes/
    );
  });

  it(`doesn't throws if graph contains circular dependencies outside affected packages`, async () => {
    const packageInfos = makePackageInfos({
      foo: { dependencies: {} },
      bar: { dependencies: {} },
      bar2: { dependencies: { bar3: '1.0.0' } },
      bar3: { dependencies: { bar2: '1.0.0', bar: '1.0.0' } },
    });

    await getPackageGraphPackageNames(['foo', 'bar'], packageInfos);
  });

  it('throws if package info is missing', async () => {
    const packageInfos = {} as PackageInfos;

    await expect(() => getPackageGraphPackageNames(['foo', 'bar'], packageInfos)).rejects.toThrow(
      `Package info is missing for foo.`
    );
  });
});
