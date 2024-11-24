import fs from 'fs-extra';
import path from 'path';
import type { PackageJson } from '../types/PackageInfo';
import { Repository, type RepositoryCloneOptions } from './repository';
import type { BeachballOptions } from '../types/BeachballOptions';
import { tmpdir } from './tmpdir';
import { gitFailFast } from 'workspace-tools';
import { setDefaultBranchName } from './gitDefaults';
import { env } from '../env';
import _ from 'lodash';

/**
 * Standard fixture options. See {@link getSinglePackageFixture}, {@link getMonorepoFixture} and
 * {@link getMultiWorkspaceFixture} for details about the structure and included files.
 */
export type FixtureType = 'single' | 'monorepo' | 'multi-workspace';

export type RootPackageJsonFixture = PackageJson & {
  /** Monorepo workspaces. These will be automatically filled in if `RepoFixture.folders` is provided. */
  workspaces?: string[];
};

export type PackageJsonFixture = Omit<PackageJson, 'name'> & {
  /** Name is inferred from the package folder name by default */
  name?: string;
  /** Allow arbitrary keys */
  [key: string]: unknown;
};

export type RepoFixture = {
  /**
   * Workspace root package.json. This is required for a single-package repo fixture (and can
   * optionally be provided for a monorepo fixture).
   *
   * In a monorepo fixture (`folders` provided), this will be generated automatically if not provided.
   * Also, `rootPackage.workpaces` will be filled in automatically.
   */
  rootPackage?: RootPackageJsonFixture;

  /**
   * Mapping from package parent folder to package folder names inside it.
   * This is required (and only makes sense) for a monorepo fixture.
   *
   * For the keys, a common example is a folder called `"packages"` with other folders inside it.
   * If packages are nested more than two levels deep, like under `"packages/grouped"`, include
   * both parent folders in the key.
   */
  folders?: {
    [folder: string]: { [packageName: string]: PackageJsonFixture };
  };

  /** Description to include in the temp folder name */
  tempDescription?: string;
};

/** Repo fixture with all required props filled out */
type FullRepoFixture = Required<Pick<RepoFixture, 'rootPackage'>> & {
  /**
   * Mapping from package parent folder to package folder names inside it.
   * Will be an empty object for a single package repo fixture.
   */
  folders: {
    // These packages have names filled out
    [folder: string]: { [packageName: string]: PackageJson };
  };
};

function getSinglePackageFixture(): RepoFixture {
  return {
    tempDescription: 'single',
    rootPackage: {
      name: 'foo',
      version: '1.0.0',
      dependencies: {
        bar: '1.0.0',
        baz: '1.0.0',
      },
    },
  };
}

/** Get a basic fixture for a monorepo root package.json (workspaces will be automatically added later) */
function getMonorepoRootPackage(name = 'monorepo-fixture'): RootPackageJsonFixture {
  return { name, version: '1.0.0', private: true };
}

/**
 * Get a monorepo fixture
 * @param parentFolder If provided, this folder name is also used as the scope in package names
 */
function getMonorepoFixture(parentFolder?: string): RepoFixture {
  const scope = parentFolder ? `@${parentFolder}/` : '';

  const beachballOptions: Partial<BeachballOptions> = {
    groups: [{ disallowedChangeTypes: null, name: 'grouped', include: 'group*' }],
  };

  return {
    tempDescription: parentFolder ? 'multimonorepo' : 'monorepo',
    rootPackage: {
      ...getMonorepoRootPackage(`${scope}monorepo-fixture`),
      beachball: beachballOptions as BeachballOptions,
      // workspaces will be added automatically later
    },
    folders: {
      packages: {
        foo: {
          name: `${scope}foo`,
          version: '1.0.0',
          dependencies: { [`${scope}bar`]: '^1.3.4' },
          main: 'src/index.ts',
          onPublish: { main: 'lib/index.js' },
          afterPublish: { notify: 'message' },
        },
        bar: { name: `${scope}bar`, version: '1.3.4', dependencies: { [`${scope}baz`]: '^1.3.4' } },
        baz: { name: `${scope}baz`, version: '1.3.4' },
      },
      'packages/grouped': {
        a: { name: `${scope}a`, version: '3.1.2' },
        b: { name: `${scope}b`, version: '3.1.2' },
      },
    },
  };
}

/**
 * Get a fixture for a repo containing multiple workspaces ("monorepos").
 * The two workspaces are under subfolders `workspace-a` and `workspace-b`, and the packages in each
 * workspace use scoped names `@workspace-a/*` and `@workspace-b/*`.
 */
function getMultiWorkspaceFixture(): { 'workspace-a': RepoFixture; 'workspace-b': RepoFixture } {
  return {
    'workspace-a': getMonorepoFixture('workspace-a'),
    'workspace-b': getMonorepoFixture('workspace-b'),
  };
}

/** Provides setup, cloning, and teardown for repository factories */
export class RepositoryFactory {
  /**
   * Primary fixture for the test *(do not use for multi-workspace)*.
   * This is public to potentially reduce hardcoded values (such as versions) in tests.
   */
  public readonly fixture: FullRepoFixture;

  /**
   * Mapping from parent folder to fixture repo (only relevant for multi-workspace).
   * Paths within each fixture will be relative to `parentFolder`.
   * For a single-repo or single monorepo fixture, its `parentFolder` will be `'.'`.
   */
  public readonly fixtures: { [parentFolder: string]: FullRepoFixture };

  /** Root directory hosting the origin repository */
  private root?: string;

  /** Description to use in temp directory names */
  private tempDescription: string;
  /** Cloned child repos, tracked so we can clean them up */
  private childRepos: Repository[] = [];

  /**
   * Create the "origin" repo and create+commit fixture files.
   * If `fixture` is a string, the corresponding default fixture is used.
   *
   * (Note that there's currently no way to create a custom multi-workspace fixture,
   * because that hasn't been needed so far.)
   */
  constructor(fixtureParam: FixtureType | RepoFixture) {
    let initialFixtures: { [parentFolder: string]: RepoFixture };
    if (fixtureParam === 'multi-workspace') {
      initialFixtures = getMultiWorkspaceFixture();
    } else {
      initialFixtures = {
        '.':
          fixtureParam === 'single'
            ? getSinglePackageFixture()
            : fixtureParam === 'monorepo'
              ? getMonorepoFixture()
              : // Clone the user-provided fixture so it's safe to modify
                _.cloneDeep(fixtureParam),
      };
    }

    this.tempDescription = typeof fixtureParam === 'string' ? fixtureParam : fixtureParam.tempDescription || 'custom';

    // Init the "origin" repo. This repo must be "bare" (has .git but no working directory) because
    // we'll be pushing to and pulling from it, which would cause the working directory and the
    // index to get out of sync. This article explains it well:
    // https://www.atlassian.com/git/tutorials/setting-up-a-repository/git-init
    this.root = tmpdir({ prefix: `beachball-${this.tempDescription}-origin-` });
    gitFailFast(['init', '--bare'], { cwd: this.root });
    setDefaultBranchName(this.root, true);

    // Initialize the repo contents by cloning the "origin" repo, committing the fixture files,
    // and pushing changes back.
    const tmpRepo = new Repository(this.root);
    tmpRepo.commitChange('README');

    // Create the fixture files and save the full fixture objects.
    // The files are committed all together at the end to speed things up.
    this.fixtures = {};
    for (const [parentFolder, fixture] of Object.entries(initialFixtures)) {
      if (!fixture.folders && !fixture.rootPackage) {
        throw new Error('`fixtures` must define `rootPackage` and/or `folders`');
      }

      fs.ensureDirSync(tmpRepo.pathTo(parentFolder));

      // fill out the root package and an empty folders object if not provided
      const rootPackage = fixture.rootPackage || getMonorepoRootPackage();
      const folders = fixture.folders || {};
      // cast is because any missing package names will be filled out later
      this.fixtures[parentFolder] = { rootPackage, folders: folders as FullRepoFixture['folders'] };

      // fill in workspaces if there are sub-folders
      const folderNames = Object.keys(folders);
      if (folderNames.length) {
        // these paths are relative to THIS workspace and should not include the parent folder
        rootPackage.workspaces = folderNames.map(folder => `${folder}/*`);
      }
      // create the root package.json
      fs.writeJSONSync(tmpRepo.pathTo(parentFolder, 'package.json'), rootPackage, { spaces: 2 });

      // create the lock file
      // (an option could be added to disable or customize this in the future if needed)
      fs.writeFileSync(tmpRepo.pathTo(parentFolder, 'yarn.lock'), '');

      // create the packages
      for (const [folder, contents] of Object.entries(folders)) {
        for (const [name, packageJson] of Object.entries(contents)) {
          // save the name if not already set
          packageJson.name ??= name;
          const pkgFolder = tmpRepo.pathTo(parentFolder, folder, name);
          fs.ensureDirSync(pkgFolder);
          fs.writeJSONSync(path.join(pkgFolder, 'package.json'), packageJson, { spaces: 2 });
        }
      }

      tmpRepo.commitAll(`committing fixture ${parentFolder}`);
    }

    this.fixture = this.fixtures['.'] || Object.values(this.fixtures)[0];

    tmpRepo.push();
    tmpRepo.cleanUp();
  }

  cloneRepository(options?: RepositoryCloneOptions): Repository {
    if (!this.root) throw new Error('Factory was already cleaned up');

    const newRepo = new Repository(this.root, this.tempDescription, options);
    this.childRepos.push(newRepo);
    return newRepo;
  }

  /**
   * Clean up the factory and its repos IF this is a local build.
   *
   * Doing this in CI is unnecessary because all the fixtures use unique temp directories (no collisions)
   * and the agents are wiped after each job, so manually deleting the files just slows things down.
   */
  cleanUp(): void {
    if (!this.root) return;

    try {
      // This occasionally throws on Windows with "resource busy"
      if (this.root && !env.isCI) {
        fs.removeSync(this.root);
      }
    } catch (err) {
      // This is non-fatal since the temp dir will eventually be cleaned up automatically
      console.warn(`Could not clean up factory: ${err}`);
    }
    this.root = undefined;
    for (const repo of this.childRepos) {
      repo.cleanUp();
    }
  }
}
