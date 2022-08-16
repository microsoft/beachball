import fs from 'fs-extra';
import path from 'path';
import { PackageJson } from '../types/PackageInfo';
import { Repository } from './repository';
import { BeachballOptions } from '../types/BeachballOptions';
import { tmpdir } from './tmpdir';
import { gitFailFast } from 'workspace-tools';
import { setDefaultBranchName } from './gitDefaults';

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
  [key: string]: any;
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
  public readonly fixture: RepoFixture;

  /**
   * Mapping from parent folder to fixture repo (only relevant for multi-workspace).
   * Paths within each fixture will be relative to `parentFolder`.
   * For a single-repo or single monorepo fixture, its `parentFolder` will be `'.'`.
   */
  public readonly fixtures: { [parentFolder: string]: RepoFixture };

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
  constructor(fixture: FixtureType | RepoFixture) {
    this.fixtures = {};
    if (fixture === 'multi-workspace') {
      this.fixtures = getMultiWorkspaceFixture();
      this.fixture = this.fixtures['workspace-a'];
    } else {
      this.fixture =
        fixture === 'single' ? getSinglePackageFixture() : fixture === 'monorepo' ? getMonorepoFixture() : fixture;
      this.fixtures['.'] = this.fixture;
    }

    this.tempDescription = typeof fixture === 'string' ? fixture : fixture.tempDescription || 'custom';

    // Init the "origin" repo. This repo must be "bare" (has .git but no working directory) because
    // we'll be pushing to and pulling from it, which would cause the working directory and the
    // index to get out of sync. This article explains it well:
    // https://www.atlassian.com/git/tutorials/setting-up-a-repository/git-init
    this.root = tmpdir({ prefix: `beachball-${this.tempDescription}-origin-` });
    gitFailFast(['init', '--bare'], { cwd: this.root });
    setDefaultBranchName(this.root);

    // Initialize the repo contents by cloning the "origin" repo, committing the fixture files,
    // and pushing changes back.
    const tmpRepo = new Repository(this.root);
    tmpRepo.commitChange('README');

    // Create the fixture files.
    // The files are committed all together at the end to speed things up.
    for (const [parentFolder, fixture] of Object.entries(this.fixtures)) {
      const { rootPackage, folders } = fixture;
      const jsonOptions = { spaces: 2 };

      if (!folders && !rootPackage) {
        throw new Error('`fixtures` must define `rootPackage` and/or `folders`');
      }

      fs.ensureDirSync(tmpRepo.pathTo(parentFolder));

      // create the root package.json
      const finalRootPackage: RootPackageJsonFixture = {
        ...(rootPackage || getMonorepoRootPackage()),
        // these paths are relative to THIS workspace and should not include the parent folder
        ...(folders && { workspaces: Object.keys(folders).map(folder => `${folder}/*`) }),
      };
      fs.writeJSONSync(tmpRepo.pathTo(parentFolder, 'package.json'), finalRootPackage, jsonOptions);

      // create the lock file
      // (an option could be added to disable or customize this in the future if needed)
      fs.writeFileSync(tmpRepo.pathTo(parentFolder, 'yarn.lock'), '');

      // create the packages
      for (const [folder, contents] of Object.entries(folders || {})) {
        for (const [name, packageJson] of Object.entries(contents)) {
          const pkgFolder = tmpRepo.pathTo(parentFolder, folder, name);
          fs.ensureDirSync(pkgFolder);
          fs.writeJSONSync(path.join(pkgFolder, 'package.json'), { name, ...packageJson }, jsonOptions);
        }
      }

      tmpRepo.commitAll(`committing fixture ${parentFolder}`);
    }

    tmpRepo.push();
    tmpRepo.cleanUp();
  }

  cloneRepository(): Repository {
    if (!this.root) throw new Error('Factory was already cleaned up');

    const newRepo = new Repository(this.root, this.tempDescription);
    this.childRepos.push(newRepo);
    return newRepo;
  }

  cleanUp() {
    if (!this.root) return;

    fs.removeSync(this.root);
    this.root = undefined;
    for (const repo of this.childRepos) {
      repo.cleanUp();
    }
  }
}
