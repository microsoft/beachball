import * as process from 'process';
import path from 'path';
import * as fs from 'fs-extra';
import { tmpdir } from './tmpdir';
import { git } from 'workspace-tools';
import { gitInitWithDefaultBranchName, setDefaultBranchName } from './gitDefaults';

export const packageJsonFixture = {
  name: 'foo',
  version: '1.0.0',
  dependencies: {
    bar: '1.0.0',
    baz: '1.0.0',
  },
};

export class RepositoryFactory {
  root?: string;
  /** Cloned child repos, tracked so we can clean them up */
  childRepos: Repository[] = [];

  create() {
    const originalDirectory = process.cwd();

    this.root = tmpdir({ prefix: 'beachball-repository-upstream-' });
    process.chdir(this.root);
    gitInitWithDefaultBranchName(this.root);

    const tmpRepo = new Repository();
    this.childRepos.push(tmpRepo);
    tmpRepo.initialize();
    tmpRepo.cloneFrom(this.root);
    tmpRepo.commitChange('README');

    fs.writeJSONSync(path.join(tmpRepo.rootPath, 'package.json'), packageJsonFixture, {
      spaces: 2,
    });
    tmpRepo.commitChange('package.json');
    tmpRepo.push('origin', 'HEAD:master');

    process.chdir(originalDirectory);
  }

  cloneRepository(): Repository {
    if (!this.root) {
      throw new Error('Must create before cloning');
    }
    const newRepo = new Repository();
    newRepo.initialize();
    newRepo.cloneFrom(this.root);
    return newRepo;
  }

  cleanUp() {
    if (!this.root) {
      throw new Error('Must create before cleaning up');
    }
    fs.removeSync(this.root);
    for (const repo of this.childRepos) {
      repo.cleanUp();
    }
  }
}

export class Repository {
  origin?: string;

  root?: string;

  initialize() {
    this.root = tmpdir({ prefix: 'beachball-repository-cloned-' });
  }

  get rootPath(): string {
    if (!this.root) {
      throw new Error('Must initialize before accessing path');
    }
    return this.root;
  }

  cloneFrom(path: string, originName?: string) {
    if (!this.root) {
      throw new Error('Must initialize before cloning');
    }

    git(['clone', ...(originName ? ['-o', originName] : []), path, '.'], { cwd: this.root });
    git(['config', 'user.email', 'ci@example.com'], { cwd: this.root });
    git(['config', 'user.name', 'CIUSER'], { cwd: this.root });

    setDefaultBranchName(this.root);

    this.origin = path;
  }

  /** Commits a change, automatically uses root path, do not pass absolute paths here */
  commitChange(newFilename: string, content?: string) {
    if (!this.root) {
      throw new Error('Must initialize before cloning');
    }

    fs.ensureFileSync(path.join(this.root, newFilename));

    if (content) {
      fs.writeFileSync(path.join(this.root, newFilename), content);
    }

    git(['add', newFilename], { cwd: this.root });
    git(['commit', '-m', `"${newFilename}"`], { cwd: this.root });
  }

  /** Commits a change, automatically uses root path, do not pass absolute paths here */
  commitAll() {
    if (!this.root) {
      throw new Error('Must initialize before cloning');
    }

    git(['add', '-A'], { cwd: this.root });
    git(['commit', '-m', 'Committing everything'], { cwd: this.root });
  }

  getCurrentHash() {
    if (!this.root) {
      throw new Error('Must initialize before getting head');
    }

    const result = git(['rev-parse', 'HEAD'], { cwd: this.root });
    return result.stdout.trim();
  }

  branch(branchName: string) {
    if (!this.root) {
      throw new Error('Must initialize before cloning');
    }

    git(['checkout', '-b', branchName], { cwd: this.root });
  }

  push(remote: string, branch: string) {
    if (!this.root) {
      throw new Error('Must initialize before push');
    }

    git(['push', remote, branch], { cwd: this.root });
  }

  cleanUp() {
    if (!this.root) {
      throw new Error('Must initialize before clean up');
    }

    fs.removeSync(this.root);
  }

  /**
   * Set to invalid root
   */
  setRemoteUrl(remote: string, remoteUrl: string) {
    if (!this.root) {
      throw new Error('Must initialize before change remote url');
    }
    git(['remote', 'set-url', remote, remoteUrl], { cwd: this.root });
  }
}
