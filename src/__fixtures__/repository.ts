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

    // factory-specific initialization
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
  /** Root temp directory for the repo */
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

  /**
   * Get the path to a file in the repo. The path segments MUST be relative to the repo root,
   * and MUST NOT start with `..`.
   *
   * These restrictions are primarily to reduce issues with path comparison and help detect
   * possible issues with operating systems representing the same path different ways, which can
   * cause flaky tests. (e.g. Mac temp files are under `/private/var` which is symlinked as `/var`,
   * and Windows can use either standard paths or short DOS paths.)
   */
  pathTo(...segments: string[]) {
    const filename = path.join(...segments);
    if (path.isAbsolute(filename)) {
      throw new Error('Path must be relative: ' + filename);
    }
    if (filename.startsWith('..')) {
      throw new Error(
        'Path must not start with .. (this may indicate an OS-specific path handling error): ' + filename
      );
    }
    return path.join(this.rootPath, filename);
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

  cloneFrom(remotePath: string) {
    this.git(['clone', remotePath, '.']);
    this.git(['config', 'user.email', 'ci@example.com']);
    this.git(['config', 'user.name', 'CIUSER']);

    setDefaultBranchName(this.rootPath);
  }

  /**
   * Creates or updates and stages a file, creating the intermediate directories if necessary.
   * Automatically uses root path; do not pass absolute paths here.
   */
  stageChange(newFilename: string, content?: string) {
    const filePath = this.pathTo(newFilename);
    fs.ensureDirSync(path.dirname(filePath));
    fs.ensureFileSync(filePath);

    if (content) {
      fs.writeFileSync(filePath, content);
    }

    this.git(['add', newFilename]);
  }

  /**
   * Commits a change, creating the intermediate directories if necessary.
   * Automatically uses root path; do not pass absolute paths here.
   */
  commitChange(newFilename: string, content?: string) {
    this.stageChange(newFilename, content);
    this.git(['commit', '-m', `"${newFilename}"`]);
  }

  /** Commits a change. Automatically uses root path; do not pass absolute paths here. */
  commitAll() {
    this.git(['add', '-A']);
    this.git(['commit', '-m', 'Committing everything']);
  }

  /**
   * Updates the content of a JSON file that already exists in the repo.
   * The updates will be merged with the original.
   */
  updateJsonFile(filename: string, updates: {}) {
    if (!filename.endsWith('.json')) {
      throw new Error('This method only works with json files');
    }

    const fullPath = this.pathTo(filename);
    const oldContent = fs.readJSONSync(fullPath);
    fs.writeJSONSync(fullPath, { ...oldContent, ...updates });

    this.git(['add', filename]);
    this.git(['commit', '-m', `"${filename}"`]);
  }

  getCurrentHash() {
    const result = this.git(['rev-parse', 'HEAD']);
    return result.stdout.trim();
  }

  /** Get tags pointing to the current HEAD commit */
  getCurrentTags() {
    const tagsResult = this.git(['tag', '--points-at', 'HEAD']);
    const trimmedResult = tagsResult.stdout.trim();
    return trimmedResult ? trimmedResult.split('\n') : [];
  }

  /** Get status with --porcelain */
  status() {
    return this.git(['status', '--porcelain']).stdout.trim();
  }

  /** Check out a branch. Args can be the name and/or any options. */
  checkout(...args: string[]) {
    this.git(['checkout', ...args]);
  }

  checkoutNewBranch(branchName: string) {
    this.checkout('-b', branchName);
  }

  checkoutDefaultBranch() {
    this.checkout(defaultBranchName);
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
