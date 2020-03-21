import * as process from 'process';
import path from 'path';
import * as fs from 'fs-extra';
import { promisify } from 'util';
import { runCommands, runInDirectory } from './exec';
import { tmpdir, DirResult } from './tmpdir';

const writeFileAsync = promisify(fs.writeFile);
const removeAsync = promisify(fs.remove);

export const packageJsonFixture = {
  name: 'foo',
  version: '1.0.0',
};

export class RepositoryFactory {
  root?: DirResult;

  async create(): Promise<void> {
    const originalDirectory = process.cwd();

    this.root = await tmpdir({ prefix: 'beachball-repository-upstream-' });
    process.chdir(this.root!.name);
    await runCommands(['git init --bare']);

    const tmpRepo = new Repository();
    await tmpRepo.initialize();
    await tmpRepo.cloneFrom(this.root.name);
    await tmpRepo.commitChange('README');

    await writeFileAsync(path.join(tmpRepo.rootPath, 'package.json'), JSON.stringify(packageJsonFixture, null, 2));
    await tmpRepo.commitChange('package.json');
    await tmpRepo.push('origin', 'HEAD:master');

    process.chdir(originalDirectory);
  }

  async cloneRepository(): Promise<Repository> {
    if (!this.root) {
      throw new Error('Must create before cloning');
    }
    const newRepo = new Repository();
    await newRepo.initialize();
    await newRepo.cloneFrom(this.root.name);
    return newRepo;
  }
}

export class Repository {
  origin?: string;

  root?: DirResult;

  async initialize() {
    this.root = await tmpdir({ prefix: 'beachball-repository-cloned-' });
  }

  get rootPath(): string {
    if (!this.root) {
      throw new Error('Must initialize before accessing path');
    }
    return this.root.name;
  }

  async cloneFrom(path: string, originName?: string): Promise<void> {
    if (!this.root) {
      throw new Error('Must initialize before cloning');
    }

    await runInDirectory(this.root.name, [
      `git clone ${originName ? '-o ' + originName + ' ' : ''}${path} .`,
      'git config user.email ci@example.com',
      'git config user.name CIUSER',
    ]);

    this.origin = path;
  }

  async commitChange(newFilename: string, content?: string) {
    if (!this.root) {
      throw new Error('Must initialize before cloning');
    }

    await fs.ensureFile(path.join(this.root.name, newFilename));

    if (content) {
      await fs.writeFile(path.join(this.root.name, newFilename), content);
    }

    await runInDirectory(this.root.name, [`git add ${newFilename}`, `git commit -m '${newFilename}'`]);
  }

  async branch(branchName: string) {
    if (!this.root) {
      throw new Error('Must initialize before cloning');
    }
    await runInDirectory(this.root.name, [`git checkout -b ${branchName}`]);
  }

  async push(remote: string, branch: string) {
    if (!this.root) {
      throw new Error('Must initialize before push');
    }

    await runInDirectory(this.root.name, [`git push ${remote} ${branch}`]);
  }

  /**
   * Clean up created repo. This isn't necessary to call manually in most cases because `tmp` will automatically
   * remove created directories on program exit (assuming `tmp.setGracefulCleanup()` is still called somewhere).
   */
  async cleanUp() {
    if (!this.root) {
      throw new Error('Must initialize before clean up');
    }

    await removeAsync(this.root.name);
  }

  /**
   * Set to invalid root
   */
  async setRemoteUrl(remote: string, remoteUrl: string) {
    if (!this.root) {
      throw new Error('Must initialize before change remote url');
    }
    await runInDirectory(this.root.name, [`git remote set-url ${remote} ${remoteUrl}`]);
  }
}
