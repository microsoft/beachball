import * as process from 'process';
import path from 'path';
import * as fs from 'fs-extra';
import { tmpdir } from './tmpdir';
import { git } from 'workspace-tools';
import {
  defaultBranchName,
  defaultRemoteName,
  gitInitWithDefaultBranchName,
  setDefaultBranchName,
} from './gitDefaults';

export const packageJsonFixture = {
  name: 'foo',
  version: '1.0.0',
  dependencies: {
    bar: '1.0.0',
    baz: '1.0.0',
  },
};

/** Provides common setup, cloning, and teardown for repository factories */
export abstract class BaseRepositoryFactory {
  private root?: string;
  /** Cloned child repos, tracked so we can clean them up */
  private childRepos: Repository[] = [];

  constructor(prefix: string) {
    const originalDirectory = process.cwd();

    this.root = tmpdir({ prefix });
    process.chdir(this.root);
    gitInitWithDefaultBranchName(this.root);

    const tmpRepo = new Repository();
    this.childRepos.push(tmpRepo);
    tmpRepo.cloneFrom(this.root);

    tmpRepo.commitChange('README');
    this.initFixture(tmpRepo);

    tmpRepo.push(defaultRemoteName, 'HEAD:' + defaultBranchName);

    process.chdir(originalDirectory);
  }

  protected abstract initFixture(tmpRepo: Repository): void;

  cloneRepository(): Repository {
    if (!this.root) {
      throw new Error('Factory was already cleaned up');
    }
    const newRepo = new Repository();
    newRepo.cloneFrom(this.root);
    return newRepo;
  }

  cleanUp() {
    if (!this.root) {
      return; // already cleaned up
    }
    fs.removeSync(this.root);
    this.root = undefined;
    for (const repo of this.childRepos) {
      repo.cleanUp();
    }
  }
}

export class RepositoryFactory extends BaseRepositoryFactory {
  constructor() {
    super('beachball-repository-upstream-');
  }

  /** Create and commit the fixture-specific files */
  protected initFixture(tmpRepo: Repository) {
    tmpRepo.commitChange('package.json', JSON.stringify(packageJsonFixture, null, 2));
  }
}

export class Repository {
  private root?: string;

  constructor() {
    this.root = tmpdir({ prefix: 'beachball-repository-cloned-' });
  }

  /** Root temp directory for the repo (throws if not initialized) */
  get rootPath(): string {
    if (!this.root) {
      throw new Error('Repo has been cleaned up');
    }
    return this.root;
  }

  /** Git helper that throws on error */
  git(args: string[]) {
    const gitResult = git(args, { cwd: this.rootPath });
    if (!gitResult.success) {
      throw new Error(`git command failed: git ${args.join(' ')}
${gitResult.stdout.toString()}
${gitResult.stderr.toString()}`);
    }
    return gitResult;
  }

  cloneFrom(path: string) {
    this.git(['clone', path, '.']);
    this.git(['config', 'user.email', 'ci@example.com']);
    this.git(['config', 'user.name', 'CIUSER']);

    setDefaultBranchName(this.rootPath);
  }

  /** Commits a change, automatically uses root path, do not pass absolute paths here */
  commitChange(newFilename: string, content?: string) {
    const filePath = path.join(this.rootPath, newFilename);
    fs.ensureFileSync(filePath);

    if (content) {
      fs.writeFileSync(filePath, content);
    }

    this.git(['add', newFilename]);
    this.git(['commit', '-m', `"${newFilename}"`]);
  }

  /** Commits a change, automatically uses root path, do not pass absolute paths here */
  commitAll() {
    this.git(['add', '-A']);
    this.git(['commit', '-m', 'Committing everything']);
  }

  getCurrentHash() {
    const result = this.git(['rev-parse', 'HEAD']);
    return result.stdout.trim();
  }

  checkoutNewBranch(branchName: string) {
    this.git(['checkout', '-b', branchName]);
  }

  checkoutDefaultBranch() {
    this.git(['checkout', defaultBranchName]);
  }

  pull(remote?: string, branch?: string) {
    this.git(['pull', remote ?? defaultRemoteName, branch ?? `HEAD:${defaultBranchName}`]);
  }

  push(remote?: string, branch?: string) {
    this.git(['push', remote ?? defaultRemoteName, branch ?? `HEAD:${defaultBranchName}`]);
  }

  setRemoteUrl(remote: string, remoteUrl: string) {
    this.git(['remote', 'set-url', remote, remoteUrl]);
  }

  cleanUp() {
    this.root && fs.removeSync(this.root);
    this.root = undefined;
  }
}
