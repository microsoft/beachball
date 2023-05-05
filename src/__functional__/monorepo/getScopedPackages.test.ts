import { describe, expect, it, beforeAll, afterAll } from '@jest/globals';
import { RepositoryFactory } from '../../__fixtures__/repositoryFactory';
import { getScopedPackages } from '../../monorepo/getScopedPackages';
import { BeachballOptions } from '../../types/BeachballOptions';
import { PackageInfos } from '../../types/PackageInfo';
import { getPackageInfos } from '../../monorepo/getPackageInfos';

describe('getScopedPackages', () => {
  // These tests don't make local changes, so cleaning up after each test is unnecessary.
  const factory = new RepositoryFactory('monorepo');
  let packageInfos: PackageInfos;

  beforeAll(() => {
    factory.init();
    packageInfos = getPackageInfos(factory.defaultRepo.rootPath);
  });
  afterAll(() => {
    factory.cleanUp();
  });

  it('can scope packages', () => {
    const scopedPackages = getScopedPackages(
      {
        path: factory.defaultRepo.rootPath,
        scope: ['packages/grouped/*'],
      } as BeachballOptions,
      packageInfos
    );

    expect(scopedPackages).toEqual(['a', 'b']);
  });

  it('can scope with excluded packages', () => {
    const scopedPackages = getScopedPackages(
      {
        path: factory.defaultRepo.rootPath,
        scope: ['!packages/grouped/*'],
      } as BeachballOptions,
      packageInfos
    );

    expect(scopedPackages).toEqual(['bar', 'baz', 'foo']);
  });

  it('can mix and match with excluded packages', () => {
    const scopedPackages = getScopedPackages(
      {
        path: factory.defaultRepo.rootPath,
        scope: ['packages/b*', '!packages/grouped/*'],
      } as BeachballOptions,
      packageInfos
    );

    expect(scopedPackages).toEqual(['bar', 'baz']);
  });
});
