import path from 'path';
import * as fs from 'fs-extra';
import { BeachballOptions } from '../types/BeachballOptions';
import { BaseRepositoryFactory, Repository } from './repository';
import { PackageJson } from '../types/PackageInfo';

export const packageJsonFixtures: { [path: string]: PackageJson } = ['repo-a', 'repo-b'].reduce(
  (fixtures, repo) => ({
    ...fixtures,
    [`${repo}`]: {
      private: true,
      name: repo,
      version: '1.0.0',
      workspaces: {
        packages: ['packages/*'],
      },
    } as PackageJson,

    [`${repo}/packages/foo`]: {
      name: `@${repo}/foo`,
      version: '1.0.0',
      dependencies: {
        bar: '^1.3.4',
      },
      main: 'src/index.ts',
      onPublish: {
        main: 'lib/index.js',
      },
    } as PackageJson,

    [`${repo}/packages/bar`]: {
      name: `@${repo}/bar`,
      version: '1.3.4',
    },

    [`${repo}/packages/grouped/a`]: {
      name: `@${repo}/a`,
      version: '3.1.2',
    },

    [`${repo}/packages/grouped/b`]: {
      name: `@${repo}/b`,
      version: '3.1.2',
      dependencies: ['bar'] as any,
    },
  }),
  {}
);

const beachballConfigFixture = {
  groups: [
    {
      disallowedChangeTypes: null,
      name: 'grouped',
      include: 'grouped*',
    },
  ],
} as BeachballOptions;

export class MultiMonoRepoFactory extends BaseRepositoryFactory {
  constructor() {
    super('beachball-multi-monorepo-upstream-');
  }

  protected initFixture(tmpRepo: Repository) {
    for (const pkg of Object.keys(packageJsonFixtures)) {
      const packageJsonFixture = packageJsonFixtures[pkg];
      const packageJsonFile = path.join(pkg, 'package.json');

      fs.mkdirpSync(path.join(tmpRepo.rootPath, pkg));

      fs.writeJSONSync(path.join(tmpRepo.rootPath, packageJsonFile), packageJsonFixture, {
        spaces: 2,
      });
      tmpRepo.commitChange(packageJsonFile);
    }

    tmpRepo.commitChange('repo-a/yarn.lock', '');
    tmpRepo.commitChange('repo-b/yarn.lock', '');

    tmpRepo.commitChange(
      'repo-a/beachball.config.js',
      'module.exports = ' + JSON.stringify(beachballConfigFixture, null, 2)
    );
    tmpRepo.commitChange(
      'repo-b/beachball.config.js',
      'module.exports = ' + JSON.stringify(beachballConfigFixture, null, 2)
    );
  }
}
