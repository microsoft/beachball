import path from 'path';
import * as fs from 'fs';
import { removeTempDir, tmpdir } from './tmpdir';
import { git, type GitProcessOutput } from 'workspace-tools';
import {
  defaultBranchName,
  defaultRemoteBranchName,
  defaultRemoteName,
  optsWithLang,
  setDefaultBranchName,
} from './gitDefaults';
import { readJson } from '../object/readJson';
import { writeJson } from '../object/writeJson';

/**
 * Clone options. See the docs for details on behavior and interaction of these options.
 * https://www.git-scm.com/docs/git-clone#Documentation/git-clone.txt
 */
export type RepositoryCloneOptions = {
  /**
   * Create a shallow clone with this depth (`--depth=X`).
   * Implies `--single-branch` unless `singleBranch: false` (`--no-single-branch`) is set.
   */
  depth?: number;
  /**
   * Check out this branch (`--branch=X`).
   * With `singleBranch: true`, this chooses which single branch to clone.
   */
  branch?: string;
  /**
   * - If true, only clone one branch (`--single-branch`): the default or as specified with `branch`.
   * - If false, explicitly set `--no-single-branch` (required to clone all branches when `depth` is set).
   * - If undefined, don't set either option.
   */
  singleBranch?: boolean;
};

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
  constructor(clonePath: string, tempDescription = 'repository', options: RepositoryCloneOptions = {}) {
    const { depth, branch, singleBranch } = options;

    this.root = tmpdir({ prefix: `beachball-${tempDescription}-cloned-` });

    const cloneResult = this.git(
      [
        'clone',
        // --no-local is necessary for --depth to be respected in local clones
        // https://www.git-scm.com/docs/git-clone#Documentation/git-clone.txt---local
        ...(depth ? [`--depth=${depth}`, '--no-local'] : []),
        ...(singleBranch ? ['--single-branch'] : singleBranch === false ? ['--no-single-branch'] : []),
        ...(branch ? [`--branch=${branch}`] : []),
        clonePath,
        '.',
      ],
      // Git logs are localized, so attempt to force this operation to use English so that the
      // warning check below works consistently. (It's not a big issue if it doesn't work, because
      // the warning check is just intended to make local test development easier in uncommon cases.)
      optsWithLang({ cwd: this.rootPath })
    );

    // If git clone gives any warnings besides "you appear to have cloned an empty repository"
    // this likely indicates an issue with the arguments, so throw an error
    // (this could otherwise cause some extremely hard-to-debug issues with tests).
    if (/^warning:(?!.*?empty repository)/m.test(cloneResult.stderr)) {
      throw new Error(`Unexpected warning from git clone (likely due to incorrect arguments):\n${cloneResult.stderr}`);
    }

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
  pathTo(...segments: string[]): string {
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
  git(args: string[], options?: Partial<Parameters<typeof git>[1]>): GitProcessOutput {
    const gitResult = git(args, { cwd: this.rootPath, ...options });
    if (!gitResult.success) {
      throw new Error(`git command failed: git ${args.join(' ')}
${gitResult.stdout.toString()}
${gitResult.stderr.toString()}`);
    }
    return gitResult;
  }

  /**
   * Create (or update) and stage a file, creating the intermediate directories if necessary.
   * Automatically uses root path; do not pass absolute paths here.
   */
  stageChange(newFilename: string, content: string | object = ''): void {
    const filePath = this.pathTo(newFilename);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });

    fs.writeFileSync(filePath, typeof content === 'string' ? content : JSON.stringify(content));

    this.git(['add', newFilename]);
  }

  /**
   * Commit a change, creating the intermediate directories if necessary.
   * Automatically uses root path; do not pass absolute paths here.
   */
  commitChange(newFilename: string, content?: string | object): void {
    this.stageChange(newFilename, content);
    this.git(['commit', '-m', `"${newFilename}"`]);
  }

  /** Commit all changes to tracked and untracked files. */
  commitAll(message = 'Committing everything'): void {
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
  updateJsonFile(filename: string, updates: object): void {
    if (!filename.endsWith('.json')) {
      throw new Error('This method only works with json files');
    }

    const fullPath = this.pathTo(filename);
    const oldContent = readJson<object>(fullPath);
    writeJson(fullPath, { ...oldContent, ...updates });

    this.git(['add', filename]);
    this.git(['commit', '-m', `"${filename}"`]);
  }

  /** Get the current HEAD sha1 */
  getCurrentHash(): string {
    const result = this.git(['rev-parse', 'HEAD']);
    return result.stdout.trim();
  }

  /** Get tags pointing to the current HEAD commit */
  getCurrentTags(): string[] {
    const tagsResult = this.git(['tag', '--points-at', 'HEAD']);
    const trimmedResult = tagsResult.stdout.trim();
    return trimmedResult ? trimmedResult.split('\n').sort() : [];
  }

  /** Get status with `--porcelain` */
  status(): string {
    return this.git(['status', '--porcelain']).stdout.trim();
  }

  /** Check out a branch. Args can be the name and/or any options. */
  checkout(...args: string[]): void {
    this.git(['checkout', ...args]);
  }

  /** Pull from the default remote and branch.  */
  pull(): void {
    this.git(['pull', defaultRemoteName, `HEAD:${defaultBranchName}`]);
  }

  /** Push to the default remote. */
  push(branchName: string = defaultBranchName): void {
    this.git(['push', defaultRemoteName, `HEAD:${branchName}`]);
  }

  /** `git reset --hard <ref>` and `git clean -dfx` */
  resetAndClean(ref: string = defaultRemoteBranchName): void {
    this.git(['reset', '--hard', ref]);
    this.git(['clean', '-dfx']);
  }

  /**
   * Clean up the repo IF this is a local build.
   *
   * Doing this in CI is unnecessary because all the fixtures use unique temp directories (no collisions)
   * and the agents are wiped after each job, so manually deleting the files just slows things down.
   */
  cleanUp(): void {
    removeTempDir(this.root);
    this.root = undefined;
  }
}
