import { getScopedPackages } from '../../monorepo/getScopedPackages';
import { BeachballOptions } from '../../types/BeachballOptions';
import { MonoRepoFactory } from '../../fixtures/monorepo';

describe('getScopedPackages', () => {
  it('can scope packages', async () => {
    const repoFactory = new MonoRepoFactory();
    await repoFactory.create();
    const repo = await repoFactory.cloneRepository();

    const scopedPackages = getScopedPackages({
      path: repo.rootPath,
      scope: ['packages/grouped/*'],
    } as BeachballOptions);

    expect(scopedPackages.includes('a')).toBeTruthy();
    expect(scopedPackages.includes('b')).toBeTruthy();

    expect(scopedPackages.includes('foo')).toBeFalsy();
    expect(scopedPackages.includes('bar')).toBeFalsy();
  });
});
