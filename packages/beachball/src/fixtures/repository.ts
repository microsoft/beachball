import * as process from 'process';
import path from 'path';
import * as fs from 'fs-extra';
import { runCommands, runInDirectory } from './exec';
import { tmpdir } from './tmpdir';

export const packageJsonFixture = {
  name: 'foo',
  version: '1.0.0',
};

export class RepositoryFactory {
  root?: string;
  /** Cloned child repos, tracked so we can clean them up */
  childRepos: Repository[] = [];

  async create(): Promise<void> {
    const originalDirectory = process.cwd();

    this.root = await tmpdir({ prefix: 'beachball-repository-upstream-' });
    process.chdir(this.root);
    await runCommands(['git init --bare']);

    const tmpRepo = new Repository();
    this.childRepos.push(tmpRepo);
    await tmpRepo.initialize();
    await tmpRepo.cloneFrom(this.root);
    await tmpRepo.commitChange('README');

    await fs.writeJSON(path.join(tmpRepo.rootPath, 'package.json'), packageJsonFixture, { spaces: 2 });
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
    await newRepo.cloneFrom(this.root);
    return newRepo;
  }

  async cleanUp() {
    if (!this.root) {
      throw new Error('Must create before cleaning up');
    }
    await fs.remove(this.root);
    for (const repo of this.childRepos) {
      await repo.cleanUp();
    }
  }
}

export class Repository {
  origin?: string;

  root?: string;

  async initialize() {
    this.root = await tmpdir({ prefix: 'beachball-repository-cloned-' });
  }

  get rootPath(): string {
    if (!this.root) {
      throw new Error('Must initialize before accessing path');
    }
    return this.root;
  }

  async cloneFrom(path: string, originName?: string): Promise<void> {
    if (!this.root) {
      throw new Error('Must initialize before cloning');
    }

    await runInDirectory(this.root, [
      `git clone ${originName ? '-o ' + originName + ' ' : ''}${path} .`,
      'git config user.email ci@example.com',
      'git config user.name CIUSER',
    ]);

    this.origin = path;
  }

  /** Commits a change, automatically uses root path, do not pass absolute paths here */
  async commitChange(newFilename: string, content?: string): Promise<void> {
    if (!this.root) {
      throw new Error('Must initialize before cloning');
    }

    await fs.ensureFile(path.join(this.root, newFilename));

    if (content) {
      await fs.writeFile(path.join(this.root, newFilename), content);
    }

    await runInDirectory(this.root, [`git add ${newFilename}`, `git commit -m '${newFilename}'`]);
  }

  async getCurrentHash(): Promise<string> {
    if (!this.root) {
      throw new Error('Must initialize before getting head');
    }

    const result = await runInDirectory(this.root, ['git rev-parse HEAD']);
    return result[0].stdout.trim();
  }

  async branch(branchName: string) {
    if (!this.root) {
      throw new Error('Must initialize before cloning');
    }
    await runInDirectory(this.root, [`git checkout -b ${branchName}`]);
  }

  async push(remote: string, branch: string) {
    if (!this.root) {
      throw new Error('Must initialize before push');
    }

    await runInDirectory(this.root, [`git push ${remote} ${branch}`]);
  }

  async cleanUp() {
    if (!this.root) {
      throw new Error('Must initialize before clean up');
    }

    await fs.remove(this.root);
  }

  /**
   * Set to invalid root
   */
  async setRemoteUrl(remote: string, remoteUrl: string) {
    if (!this.root) {
      throw new Error('Must initialize before change remote url');
    }
    await runInDirectory(this.root, [`git remote set-url ${remote} ${remoteUrl}`]);
  }
}
