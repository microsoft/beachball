import path from 'path';
import { BeachballOptions } from '../types/BeachballOptions';
import { BaseRepositoryFactory, Repository } from './repository';
import { PackageJson } from '../types/PackageInfo';

export const packageJsonFixtures: { [path: string]: PackageJson } = {
  'packages/foo': {
    name: 'foo',
    version: '1.0.0',
    dependencies: {
      bar: '^1.3.4',
    },
    main: 'src/index.ts',
    onPublish: {
      main: 'lib/index.js',
    },
    afterPublish: {
      notify: 'message',
    },
  } as PackageJson,

  'packages/bar': {
    name: 'bar',
    version: '1.3.4',
    dependencies: {
      baz: '^1.3.4',
    },
  },

  'packages/baz': {
    name: 'baz',
    version: '1.3.4',
  },

  'packages/grouped/a': {
    name: 'a',
    version: '3.1.2',
  },

  'packages/grouped/b': {
    name: 'b',
    version: '3.1.2',
    dependencies: ['bar'] as any,
  },
};

const beachballConfigFixture = {
  groups: [
    {
      disallowedChangeTypes: null,
      name: 'grouped',
      include: 'grouped*',
    },
  ],
} as BeachballOptions;

export class MonoRepoFactory extends BaseRepositoryFactory {
  constructor() {
    super('beachball-monorepo-upstream-');
  }

  protected initFixture(tmpRepo: Repository) {
    for (const [pkgName, pkgFixture] of Object.entries(packageJsonFixtures)) {
      tmpRepo.commitChange(path.join(pkgName, 'package.json'), JSON.stringify(pkgFixture, null, 2));
    }

    tmpRepo.commitChange('package.json', JSON.stringify({ name: 'monorepo-fixture', version: '1.0.0' }, null, 2));

    tmpRepo.commitChange('beachball.config.js', 'module.exports = ' + JSON.stringify(beachballConfigFixture, null, 2));
  }
}
