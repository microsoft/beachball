import { describe, expect, it } from '@jest/globals';
import type { PackageInfos } from '../../types/PackageInfo';
import { makePackageInfos } from '../../__fixtures__/packageInfos';
import { getPackageGraph } from '../../monorepo/getPackageGraph';
import { getPackageGraphLayers } from '../../publish/getPackageGraphLayers';
import { generateChangeSet } from '../../__fixtures__/changeFiles';

describe('getPackageGraph', () => {
  /**
   * Run the PGraph returned by `getPackageGraph`, and return the package names in the order that
   * they were visited.
   */
  async function getPackageGraphPackageNames(
    affectedPackages: string[],
    packageInfos: PackageInfos
  ): Promise<string[]> {
    const visitedPackages: string[] = [];
    const packageGraph = getPackageGraph(affectedPackages, packageInfos, packageInfo => {
      visitedPackages.push(packageInfo.name);
    });
    await packageGraph.run({ concurrency: 1 });

    return visitedPackages;
  }

  /**
   * Ensure that both `getPackageGraph` and `getPackageGraphLayers` return a valid ordering of packages,
   * considering the same dependency types.
   */
  async function validateOrdering(
    inputPackages: string[],
    packageInfos: PackageInfos,
    possibleSolutions: string[][]
  ): Promise<void> {
    const getPackageGraphLayersOutput = getPackageGraphLayers({
      packagesToPublish: inputPackages,
      bumpInfo: { packageInfos, changeFileChangeInfos: generateChangeSet(inputPackages) },
      options: { bumpDeps: true, scope: null },
    }).flat();
    const getPackageGraphPackageNamesOutput = await getPackageGraphPackageNames(inputPackages, packageInfos);

    expect(possibleSolutions).toContainEqual(getPackageGraphLayersOutput);
    expect(possibleSolutions).toContainEqual(getPackageGraphPackageNamesOutput);
  }

  it('sort packages which none of them has dependency', async () => {
    const packageInfos: PackageInfos = makePackageInfos({ foo: {}, bar: {} });

    await validateOrdering(['foo', 'bar'], packageInfos, [
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

    await validateOrdering(['foo', 'foo2', 'foo3'], packageInfos, [['foo2', 'foo3', 'foo']]);
  });

  it.each(['dependencies', 'peerDependencies', 'optionalDependencies'] as const)(
    'considers %s for ordering',
    async dependencyType => {
      const packageInfos = makePackageInfos({
        foo: { [dependencyType]: { foo3: '1.0.0' } },
        foo2: {},
        foo3: { dependencies: { foo2: '1.0.0' } },
      });

      await validateOrdering(['foo', 'foo2', 'foo3'], packageInfos, [['foo2', 'foo3', 'foo']]);
    }
  );

  it('does not consider devDependencies', async () => {
    const packageInfos = makePackageInfos({
      foo: { devDependencies: { foo3: '1.0.0' } },
      foo2: {},
      foo3: { dependencies: { foo2: '1.0.0' } },
    });

    await validateOrdering(['foo', 'foo2', 'foo3'], packageInfos, [['foo', 'foo2', 'foo3']]);
  });

  it('sort packages with different kinds of dependencies', async () => {
    const packageInfos = makePackageInfos({
      foo: { dependencies: { foo3: '1.0.0' }, peerDependencies: { foo4: '1.0.0', bar: '1.0.0' } },
      foo2: {},
      foo3: { dependencies: { foo2: '1.0.0' } },
      foo4: {},
    });

    await validateOrdering(['foo', 'foo2', 'foo3', 'foo4'], packageInfos, [
      ['foo2', 'foo3', 'foo4', 'foo'],
      ['foo2', 'foo4', 'foo3', 'foo'],
    ]);
  });

  it('do not sort packages if it is not included', async () => {
    const packageInfos = makePackageInfos({
      foo: { dependencies: { foo3: '1.0.0', bar: '1.0.0' } },
      foo2: {},
      foo3: { dependencies: { foo2: '1.0.0' } },
    });

    await validateOrdering(['foo', 'foo3'], packageInfos, [['foo3', 'foo']]);
  });

  it('do not sort packages if it is not included harder scenario', async () => {
    const packageInfos = makePackageInfos({
      foo: { dependencies: { foo3: '1.0.0', bar: '1.0.0' } },
      foo2: { dependencies: { foo4: '1.0.0' } },
      foo3: { dependencies: { foo2: '1.0.0' } },
      foo4: {},
      bar: { dependencies: { foo: '1.0.0' } },
    });

    await validateOrdering(['foo', 'foo3'], packageInfos, [['foo3', 'foo']]);
  });

  it('throws if contains circular dependencies inside affected packages', async () => {
    const packageInfos = makePackageInfos({
      foo: { dependencies: { bar: '1.0.0' } },
      bar: { dependencies: { foo: '1.0.0' } },
    });

    await expect(async () => {
      await getPackageGraphPackageNames(['foo', 'bar'], packageInfos);
    }).rejects.toThrow(
      /We could not find a node in the graph with no dependencies; this likely means there is a cycle including all nodes/
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
      /We could not find a node in the graph with no dependencies; this likely means there is a cycle including all nodes/
    );
  });

  it(`doesn't throws if graph contains circular dependencies outside affected packages`, async () => {
    const packageInfos = makePackageInfos({
      foo: {},
      bar: {},
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
