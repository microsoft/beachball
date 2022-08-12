import { getScopedPackages } from '../../monorepo/getScopedPackages';
import { BeachballOptions } from '../../types/BeachballOptions';
import { MonoRepoFactory } from '../../__fixtures__/monorepo';
import { Repository } from '../../__fixtures__/repository';
import { PackageInfos } from '../../types/PackageInfo';
import { getPackageInfos } from '../../monorepo/getPackageInfos';

describe('getScopedPackages', () => {
  let repoFactory: MonoRepoFactory;
  let repo: Repository;
  let packageInfos: PackageInfos;

  beforeAll(() => {
    repoFactory = new MonoRepoFactory();
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
      } as BeachballOptions,
      packageInfos
    );

    expect(scopedPackages.includes('a')).toBeTruthy();
    expect(scopedPackages.includes('b')).toBeTruthy();

    expect(scopedPackages.includes('foo')).toBeFalsy();
    expect(scopedPackages.includes('bar')).toBeFalsy();
  });

  it('can scope with excluded packages', () => {
    const scopedPackages = getScopedPackages(
      {
        path: repo.rootPath,
        scope: ['!packages/grouped/*'],
      } as BeachballOptions,
      packageInfos
    );

    expect(scopedPackages.includes('a')).toBeFalsy();
    expect(scopedPackages.includes('b')).toBeFalsy();

    expect(scopedPackages.includes('foo')).toBeTruthy();
    expect(scopedPackages.includes('bar')).toBeTruthy();
  });

  it('can mix and match with excluded packages', () => {
    const scopedPackages = getScopedPackages(
      {
        path: repo.rootPath,
        scope: ['packages/b*', '!packages/grouped/*'],
      } as BeachballOptions,
      packageInfos
    );

    expect(scopedPackages.includes('a')).toBeFalsy();
    expect(scopedPackages.includes('b')).toBeFalsy();

    expect(scopedPackages.includes('foo')).toBeFalsy();
    expect(scopedPackages.includes('bar')).toBeTruthy();
  });
});
