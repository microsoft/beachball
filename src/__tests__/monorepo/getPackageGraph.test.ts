import { describe, expect, it } from '@jest/globals';
import { toposortPackages } from '../../publish/toposortPackages';
import { PackageInfo, PackageInfos } from '../../types/PackageInfo';
import { makePackageInfos } from '../../__fixtures__/packageInfos';
import { getPackageGraph } from '../../monorepo/getPackageGraph';

describe('getPackageGraph', () => {
  /**
   * @returns all package names in the package graph
   */
  async function getPackageGraphPackageNames(
    affectedPackages: Iterable<string>,
    packageInfos: PackageInfos,
    runHook?: (packageInfo: PackageInfo) => Promise<void>
  ): Promise<string[]> {
    const visitedPackages: string[] = [];
    const packageGraph = getPackageGraph(affectedPackages, packageInfos, async (packageInfo: PackageInfo) => {
      visitedPackages.push(packageInfo.name);
      if (runHook) {
        await runHook(packageInfo);
      }
    });
    await packageGraph.run({
      concurrency: 1,
      continue: false,
    });

    return visitedPackages;
  }

  /**
   * Ensure that both `toposortPackages` and `getPackageGraph` are running the same logic for sorting packages.
   */
  async function validateToposortPackagesAndPackageGraph(
    inputPackages: string[],
    packageInfos: PackageInfos,
    possibleSolutions: string[][]
  ): Promise<void> {
    const toposortPackagesOutput = toposortPackages(inputPackages, packageInfos);
    const getPackageGraphPackageNamesOutput = await getPackageGraphPackageNames(inputPackages, packageInfos);

    expect(possibleSolutions).toContainEqual(toposortPackagesOutput);
    expect(possibleSolutions).toContainEqual(getPackageGraphPackageNamesOutput);
  }

  it('sort packages which none of them has dependency', async () => {
    const packageInfos: PackageInfos = makePackageInfos({ foo: {}, bar: {} });

    await validateToposortPackagesAndPackageGraph(['foo', 'bar'], packageInfos, [
      ['foo', 'bar'],
      ['bar', 'foo'],
    ]);
  });

  it('sort packages with dependencies', async () => {
    const packageInfos = makePackageInfos({
      foo: {
        dependencies: { foo3: '1.0.0', bar2: '1.0.0' },
      },
      foo3: { dependencies: { foo2: '1.0.0' } },
      foo2: {},
    });

    await validateToposortPackagesAndPackageGraph(['foo', 'foo2', 'foo3'], packageInfos, [['foo2', 'foo3', 'foo']]);
  });

  it('sort packages with different kinds of dependencies', async () => {
    const packageInfos = makePackageInfos({
      foo: { dependencies: { foo3: '1.0.0' }, peerDependencies: { foo4: '1.0.0', bar: '1.0.0' } },
      foo2: { dependencies: {} },
      foo3: { dependencies: { foo2: '1.0.0' } },
      foo4: { devDependencies: { foo2: '1.0.0' } },
    });

    await validateToposortPackagesAndPackageGraph(['foo', 'foo2', 'foo3', 'foo4'], packageInfos, [
      ['foo2', 'foo3', 'foo4', 'foo'],
      ['foo2', 'foo4', 'foo3', 'foo'],
    ]);
  });

  it('sort packages with all different kinds of dependencies', async () => {
    const packageInfos = makePackageInfos({
      foo: { dependencies: { foo3: '1.0.0' }, peerDependencies: { foo4: '1.0.0', bar: '1.0.0' } },
      foo2: { dependencies: {} },
      foo3: { optionalDependencies: { foo2: '1.0.0' } },
      foo4: { devDependencies: { foo2: '1.0.0' } },
    });

    await validateToposortPackagesAndPackageGraph(['foo', 'foo2', 'foo3', 'foo4'], packageInfos, [
      ['foo2', 'foo3', 'foo4', 'foo'],
    ]);
  });

  it('do not sort packages if it is not included', async () => {
    const packageInfos = makePackageInfos({
      foo: { dependencies: { foo3: '1.0.0', bar: '1.0.0' } },
      foo2: {},
      foo3: { dependencies: { foo2: '1.0.0' } },
    });

    await validateToposortPackagesAndPackageGraph(['foo', 'foo3'], packageInfos, [['foo3', 'foo']]);
  });

  it('do not sort packages if it is not included harder scenario', async () => {
    const packageInfos = makePackageInfos({
      foo: { dependencies: { foo3: '1.0.0', bar: '1.0.0' } },
      foo2: { dependencies: { foo4: '1.0.0' } },
      foo3: { dependencies: { foo2: '1.0.0' } },
      foo4: { dependencies: {} },
      bar: { dependencies: { foo: '1.0.0' } },
    });

    await validateToposortPackagesAndPackageGraph(['foo', 'foo3'], packageInfos, [['foo3', 'foo']]);
  });

  it('throws if contains circular dependencies inside affected packages', async () => {
    const packageInfos = makePackageInfos({
      foo: { dependencies: { bar: '1.0.0' } },
      bar: { dependencies: { foo: '1.0.0' } },
    });

    await expect(async () => {
      await getPackageGraphPackageNames(['foo', 'bar'], packageInfos);
    }).rejects.toThrow(
      /We could not find a node in the graph with no dependencies, this likely means there is a cycle including all nodes/
    );
  });

  it('throws if contains circular dependencies', async () => {
    const packageInfos = makePackageInfos({
      foo: { dependencies: { bar: '1.0.0', bar2: '1.0.0' } },
      bar: { dependencies: { foo: '1.0.0' } },
    });

    await expect(async () => {
      await getPackageGraphPackageNames(['foo', 'bar'], packageInfos);
    }).rejects.toThrow(
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

    await expect(async () => {
      await getPackageGraphPackageNames(['foo', 'bar'], packageInfos);
    }).rejects.toThrow(`Package info is missing for foo.`);
  });
});
