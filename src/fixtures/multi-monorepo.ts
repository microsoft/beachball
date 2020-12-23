import * as process from 'process';
import path from 'path';
import * as fs from 'fs-extra';
import { tmpdir } from './tmpdir';
import { BeachballOptions } from '../types/BeachballOptions';
import { Repository, RepositoryFactory } from './repository';
import { PackageJson } from '../types/PackageInfo';
import { git } from '../git';

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
      name: 'foo',
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
      name: 'bar',
      version: '1.3.4',
    },

    [`${repo}/packages/grouped/a`]: {
      name: 'a',
      version: '3.1.2',
    },

    [`${repo}/packages/grouped/b`]: {
      name: 'b',
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

export class MultiMonoRepoFactory extends RepositoryFactory {
  root?: string;

  create() {
    const originalDirectory = process.cwd();

    this.root = tmpdir({ prefix: 'beachball-multi-monorepository-upstream-' });
    process.chdir(this.root);
    git(['init', '--bare'], { cwd: this.root });

    const tmpRepo = new Repository();
    this.childRepos.push(tmpRepo);
    tmpRepo.initialize();
    tmpRepo.cloneFrom(this.root);
    tmpRepo.commitChange('README');

    for (const pkg of Object.keys(packageJsonFixtures)) {
      const packageJsonFixture = packageJsonFixtures[pkg];
      const packageJsonFile = path.join(pkg, 'package.json');

      fs.mkdirpSync(path.join(tmpRepo.rootPath, pkg));

      fs.writeJSONSync(path.join(tmpRepo.rootPath, packageJsonFile), packageJsonFixture, {
        spaces: 2,
      });
      tmpRepo.commitChange(packageJsonFile);
    }

    tmpRepo.commitChange('package.json', JSON.stringify({ name: 'multi-monorepo-fixture', version: '1.0.0' }, null, 2));
    tmpRepo.commitChange('yarn.lock', '');

    tmpRepo.commitChange(
      'repo-a/beachball.config.js',
      'module.exports = ' + JSON.stringify(beachballConfigFixture, null, 2)
    );
    tmpRepo.commitChange(
      'repo-b/beachball.config.js',
      'module.exports = ' + JSON.stringify(beachballConfigFixture, null, 2)
    );

    tmpRepo.push('origin', 'HEAD:master');

    process.chdir(originalDirectory);
  }
}
