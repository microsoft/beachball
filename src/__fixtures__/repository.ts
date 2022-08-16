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

    tmpRepo.push();

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

/**
 * Represents a git repository.
 *
 * All git operations will throw on error (or if the repo has already been cleaned up),
 * to make error detection easier.
 *
 * If the repository was created by a `RepositoryFactory`, cleanup will be handled automatically
 * as long as you call `repositoryFactory.cleanUp()`.
 */
export class Repository {
  /** Root temp directory for the repo */
  private root?: string;

  constructor() {
    this.root = tmpdir({ prefix: 'beachball-repository-cloned-' });
  }

  /** Root temp directory for the repo (throws if already cleaned up) */
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

  /**
   * Clone the given remote repo into the temp directory and configure settings that are needed
   * by certain tests (user name+email and default branch).
   */
  cloneFrom(remotePath: string) {
    this.git(['clone', remotePath, '.']);
    this.git(['config', 'user.email', 'ci@example.com']);
    this.git(['config', 'user.name', 'CIUSER']);

    setDefaultBranchName(this.rootPath);
  }

  /**
   * Create (or update) and stage a file, creating the intermediate directories if necessary.
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
   * Commit a change, creating the intermediate directories if necessary.
   * Automatically uses root path; do not pass absolute paths here.
   */
  commitChange(newFilename: string, content?: string) {
    this.stageChange(newFilename, content);
    this.git(['commit', '-m', `"${newFilename}"`]);
  }

  /** Commit all changes to tracked and untracked files. */
  commitAll(message: string = 'Committing everything') {
    this.git(['add', '-A']);
    this.git(['commit', '-m', message]);
  }

  /**
   * Update the content of a JSON file that already exists in the repo.
   * The updates will be merged with the original.
   *
   * This is useful if you'd like to mostly use a built-in fixture but change one package,
   * such as making it private.
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

  /** Get the current HEAD sha1 */
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

  /** Get status with `--porcelain` */
  status() {
    return this.git(['status', '--porcelain']).stdout.trim();
  }

  /** Check out a branch. Args can be the name and/or any options. */
  checkout(...args: string[]) {
    this.git(['checkout', ...args]);
  }

  /** Pull from the default remote and branch.  */
  pull() {
    this.git(['pull', defaultRemoteName, `HEAD:${defaultBranchName}`]);
  }

  /** Push to the default remote and branch. */
  push() {
    this.git(['push', defaultRemoteName, `HEAD:${defaultBranchName}`]);
  }

  /** Delete the temp files for this repository. */
  cleanUp() {
    this.root && fs.removeSync(this.root);
    this.root = undefined;
  }
}
