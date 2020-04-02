import * as process from 'process';
import path from 'path';
import * as fs from 'fs-extra';
import { runCommands } from './exec';
import { tmpdir } from './tmpdir';
import { BeachballOptions } from '../types/BeachballOptions';
import { Repository, RepositoryFactory } from './repository';

export const packageJsonFixtures = {
  'packages/foo': {
    name: 'foo',
    version: '1.0.0',
    dependencies: {
      bar: '^1.3.4',
    },
  },

  'packages/bar': {
    name: 'bar',
    version: '1.3.4',
  },

  'packages/grouped/a': {
    name: 'a',
    version: '3.1.2',
  },

  'packages/grouped/b': {
    name: 'b',
    version: '3.1.2',
    dependencies: ['bar'],
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

export class MonoRepoFactory extends RepositoryFactory {
  root?: string;

  async create(): Promise<void> {
    const originalDirectory = process.cwd();

    this.root = await tmpdir({ prefix: 'beachball-monorepository-upstream-' });
    process.chdir(this.root);
    await runCommands(['git init --bare']);

    const tmpRepo = new Repository();
    this.childRepos.push(tmpRepo);
    await tmpRepo.initialize();
    await tmpRepo.cloneFrom(this.root);
    await tmpRepo.commitChange('README');

    await Object.keys(packageJsonFixtures).reduce(async (p, pkg) => {
      await p;
      const packageJsonFixture = packageJsonFixtures[pkg];
      const packageJsonFile = path.join(tmpRepo.rootPath, pkg, 'package.json');

      fs.mkdirpSync(path.dirname(packageJsonFile));

      await fs.writeFile(packageJsonFile, JSON.stringify(packageJsonFixture, null, 2));
      await tmpRepo.commitChange(packageJsonFile);
    }, Promise.resolve());

    await tmpRepo.commitChange('package.json', JSON.stringify({ name: 'monorepo-fixture', version: '1.0.0' }, null, 2));
    await tmpRepo.commitChange(
      'beachball.config.js',
      'module.exports = ' + JSON.stringify(beachballConfigFixture, null, 2)
    );
    await tmpRepo.push('origin', 'HEAD:master');

    process.chdir(originalDirectory);
  }
}
