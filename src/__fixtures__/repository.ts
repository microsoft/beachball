import path from 'path';
import * as fs from 'fs-extra';
import { tmpdir } from './tmpdir';
import { git } from 'workspace-tools';
import { defaultBranchName, defaultRemoteName, setDefaultBranchName } from './gitDefaults';

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

  /**
   * Clone the given remote repo into a temp directory and configure settings that are needed
   * by certain tests (user name+email and default branch).
   */
  constructor(clonePath: string, tempDescription: string = 'repository') {
    this.root = tmpdir({ prefix: `beachball-${tempDescription}-cloned-` });

    this.git(['clone', clonePath, '.']);

    this.git(['config', 'user.email', 'ci@example.com']);
    this.git(['config', 'user.name', 'CIUSER']);
    setDefaultBranchName(this.rootPath);
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
   * Create or update a file, creating the intermediate directories if necessary.
   * Automatically uses root path; do not pass absolute paths here.
   */
  writeChange(newFilename: string, content?: string) {
    const filePath = this.pathTo(newFilename);
    fs.ensureDirSync(path.dirname(filePath));
    fs.ensureFileSync(filePath);

    if (content) {
      fs.writeFileSync(filePath, content);
    }
  }

  /**
   * Create (or update) and stage a file, creating the intermediate directories if necessary.
   * Automatically uses root path; do not pass absolute paths here.
   */
  stageChange(newFilename: string, content?: string) {
    this.writeChange(newFilename, content);
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
    try {
      // This occasionally throws on Windows with "resource busy"
      this.root && fs.removeSync(this.root);
    } catch (err) {
      // This is non-fatal since the temp dir will eventually be cleaned up automatically
      console.warn('Could not clean up repository: ' + err);
    }
    this.root = undefined;
  }
}
