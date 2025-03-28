import { describe, expect, it, beforeAll, afterAll } from '@jest/globals';
import type { Repository } from '../../__fixtures__/repository';
import { RepositoryFactory } from '../../__fixtures__/repositoryFactory';
import { getScopedPackages } from '../../monorepo/getScopedPackages';
import type { PackageInfos } from '../../types/PackageInfo';
import { getPackageInfos } from '../../monorepo/getPackageInfos';

describe('getScopedPackages', () => {
  let repoFactory: RepositoryFactory;
  let repo: Repository;
  let packageInfos: PackageInfos;

  beforeAll(() => {
    repoFactory = new RepositoryFactory('monorepo');
    repo = repoFactory.cloneRepository();
    packageInfos = getPackageInfos(repo.rootPath);
  });
  afterAll(() => {
    repoFactory.cleanUp();
  });

  it('can scope packages', () => {
    const scopedPackages = getScopedPackages(
      {
        path: repo.rootPath,
        scope: ['packages/grouped/*'],
      },
      packageInfos
    );

    expect(scopedPackages).toEqual(['a', 'b']);
  });

  it('can scope with excluded packages', () => {
    const scopedPackages = getScopedPackages(
      {
        path: repo.rootPath,
        scope: ['!packages/grouped/*'],
      },
      packageInfos
    );

    expect(scopedPackages).toEqual(['bar', 'baz', 'foo']);
  });

  it('can mix and match with excluded packages', () => {
    const scopedPackages = getScopedPackages(
      {
        path: repo.rootPath,
        scope: ['packages/b*', '!packages/grouped/*'],
      },
      packageInfos
    );

    expect(scopedPackages).toEqual(['bar', 'baz']);
  });
});
