import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';
import * as workspaceTools from 'workspace-tools';
import { catalogsToYaml, type Catalogs, getBranchChanges } from 'workspace-tools';
import { defaultRemoteBranchName } from '../../__fixtures__/gitDefaults';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import { makePackageInfos } from '../../__fixtures__/packageInfos';
import type { Repository } from '../../__fixtures__/repository';
import { RepositoryFactory } from '../../__fixtures__/repositoryFactory';
import { getCatalogChangedPackages } from '../../changefile/getCatalogChangedPackages';
import { getPackageInfos } from '../../monorepo/getPackageInfos';
import { getScopedPackages } from '../../monorepo/getScopedPackages';
import { getParsedOptions } from '../../options/getOptions';
import type { PackageInfos, ScopedPackages } from '../../types/PackageInfo';

jest.mock('workspace-tools', () => {
  const original = jest.requireActual<typeof workspaceTools>('workspace-tools');
  return {
    ...original,
    getFileFromRef: jest.fn(original.getFileFromRef),
    getCatalogs: jest.fn(original.getCatalogs),
    getCatalogFilePath: jest.fn(original.getCatalogFilePath),
  };
});
const realWorkspaceTools = jest.requireActual<typeof workspaceTools>('workspace-tools');
const mockWorkspaceTools = workspaceTools as jest.Mocked<typeof workspaceTools>;

type CatalogFilePathResult = ReturnType<typeof workspaceTools.getCatalogFilePath>;

const initialCatalogs = {
  default: { foo: '^1.0.0', baz: '^1.0.0' },
  named: { test: { bar: '^2.0.0' } },
} as const satisfies Catalogs; // this allows seeing the values in intellisense below

describe('getCatalogChangedPackages (mock git)', () => {
  const logs = initMockLogs();
  let mockFileFromRef: string | undefined;
  let mockCatalogs: Catalogs | undefined;
  let mockCatalogFilePathResult: CatalogFilePathResult | undefined;

  // Shared package set covering each `catalog:` dep shape and exclusion case.
  const sharedPackageInfos = makePackageInfos({
    plain: {},
    alpha: { dependencies: { foo: 'catalog:' } },
    beta: { dependencies: { bar: 'catalog:test' } },
    gamma: { devDependencies: { foo: 'catalog:', bar: 'catalog:test' } },
    delta: { peerDependencies: { foo: 'catalog:', bar: '^1.0.0' } },
    epsilon: { dependencies: { baz: 'catalog:' } },
    secret: { private: true, dependencies: { foo: 'catalog:' } },
  });

  function getCatalogChangedPackagesWrapper(params: {
    /**
     * Catalogs in the current working tree, returned by mock `getCatalogs`.
     * (If this is defined, mock `getCatalogFilePath` will return a result for yarn catalogs.)
     */
    current?: Catalogs;
    /** Catalogs in the remote branch, returned by mock `getFileFromRef` */
    initial?: Catalogs;
    /** Defaults to `sharedPackageInfos` */
    packageInfos?: PackageInfos;
    /**
     * Changed files (only needs to include `.yarnrc.yml`).
     * Defaults to `.yarnrc.yml` if `current !== initial`, or empty otherwise.
     */
    allChangedFiles?: string[];
    /** Defaults to all packages in `packageInfos` */
    scopedPackages?: ScopedPackages;
    verbose?: boolean;
  }) {
    const {
      packageInfos = sharedPackageInfos,
      initial,
      current,
      allChangedFiles = current !== initial ? ['.yarnrc.yml'] : [],
    } = params;
    mockCatalogs = current;
    mockFileFromRef = initial ? catalogsToYaml(initial) : undefined;
    mockCatalogFilePathResult = current ? { filePath: '/fake/.yarnrc.yml', manager: 'yarn' } : undefined;

    return getCatalogChangedPackages({
      options: { branch: 'origin/main', path: '/fake', verbose: !!params.verbose },
      packageInfos,
      scopedPackages: params.scopedPackages ?? new Set(Object.keys(packageInfos)),
      allChangedFiles: new Set(allChangedFiles),
    });
  }

  beforeAll(() => {
    mockWorkspaceTools.getFileFromRef.mockImplementation(() => mockFileFromRef);
    mockWorkspaceTools.getCatalogs.mockImplementation(() => mockCatalogs);
    mockWorkspaceTools.getCatalogFilePath.mockImplementation(() => mockCatalogFilePathResult);
  });

  afterEach(() => {
    mockFileFromRef = undefined;
    mockCatalogs = undefined;
    mockCatalogFilePathResult = undefined;
    jest.clearAllMocks();
  });

  it('returns empty when no catalog file exists', () => {
    const result = getCatalogChangedPackagesWrapper({ allChangedFiles: [] });
    expect(result).toEqual([]);
    expect(mockWorkspaceTools.getFileFromRef).not.toHaveBeenCalled();
  });

  it('returns empty when the catalog file is unchanged', () => {
    const result = getCatalogChangedPackagesWrapper({
      initial: initialCatalogs,
      current: initialCatalogs,
      allChangedFiles: [],
    });
    expect(result).toEqual([]);

    // There should be no git operations since the catalog file is unchanged.
    // Reducing git operations is important for perf in very large repos, especially for
    // commands like `change` which users run often.
    expect(mockWorkspaceTools.getFileFromRef).not.toHaveBeenCalled();
  });

  it('returns empty when only an unreferenced catalog entry changed', () => {
    const current: Catalogs = {
      default: { ...initialCatalogs.default, unused: '^9.0.0' },
      named: initialCatalogs.named,
    };
    const result = getCatalogChangedPackagesWrapper({ initial: initialCatalogs, current });
    expect(result).toEqual([]);
    expect(mockWorkspaceTools.getFileFromRef).toHaveBeenCalled();
  });

  it('returns packages referencing a changed named catalog entry', () => {
    const current: Catalogs = {
      default: initialCatalogs.default,
      named: { test: { bar: '^2.1.0' } },
    };
    const result = getCatalogChangedPackagesWrapper({ initial: initialCatalogs, current });
    expect(result.sort()).toEqual(['beta', 'gamma']);
  });

  it('returns packages referencing a newly added default catalog entry', () => {
    const current: Catalogs = {
      default: { ...initialCatalogs.default, newdep: '^3.0.0' },
      named: initialCatalogs.named,
    };
    const packageInfos = makePackageInfos({
      onlynew: { dependencies: { newdep: 'catalog:' } },
    });
    const result = getCatalogChangedPackagesWrapper({ initial: initialCatalogs, current, packageInfos });
    expect(result).toEqual(['onlynew']);
  });

  it('does not return packages when a catalog entry was only removed', () => {
    const current: Catalogs = {
      // foo removed; alpha/gamma/delta still reference it but should NOT be flagged
      // (the package manager would have errored on install in this case)
      default: { baz: '^1.0.0' },
      named: initialCatalogs.named,
    };
    const result = getCatalogChangedPackagesWrapper({ initial: initialCatalogs, current });
    expect(result).toEqual([]);
  });

  it('excludes private packages even when their catalog dep changed', () => {
    const current: Catalogs = {
      default: { ...initialCatalogs.default, foo: '^1.2.0' },
      named: initialCatalogs.named,
    };
    const result = getCatalogChangedPackagesWrapper({ initial: initialCatalogs, current });
    expect(result).not.toContain('secret');
  });

  it('excludes out-of-scope packages even when their catalog dep changed', () => {
    const current: Catalogs = {
      default: { ...initialCatalogs.default, foo: '^1.3.0' },
      named: initialCatalogs.named,
    };
    const result = getCatalogChangedPackagesWrapper({
      initial: initialCatalogs,
      current,
      scopedPackages: new Set(['alpha']),
    });
    expect(result).toEqual(['alpha']);
  });

  it('returns combined results across default and named catalog changes', () => {
    const current: Catalogs = {
      default: { ...initialCatalogs.default, foo: '^1.4.0' },
      named: { test: { bar: '^2.2.0' } },
    };
    const result = getCatalogChangedPackagesWrapper({ initial: initialCatalogs, current });
    expect(result.sort()).toEqual(['alpha', 'beta', 'delta', 'gamma']);
  });

  it('treats every entry as changed when the catalog file is brand new', () => {
    // No old content: getFileFromRef returns undefined, so every current entry counts as a change
    const result = getCatalogChangedPackagesWrapper({
      current: { default: { foo: '^1.0.0' } },
    });
    expect(result.sort()).toEqual(['alpha', 'delta', 'gamma']);
  });

  it('logs verbose output for each affected package', () => {
    const current: Catalogs = {
      default: { foo: '^1.4.0', baz: '^1.0.0' },
      named: { test: { bar: '^2.2.0' } },
    };
    getCatalogChangedPackagesWrapper({ initial: initialCatalogs, current, verbose: true });
    expect(logs.getMockLines('all')).toMatchInlineSnapshot(`
      "[log] Checking for changes to catalog: dependencies...
      [log] catalog: dependencies referenced by the following packages have changed:
      [log]   - alpha: foo
      [log]   - beta: bar
      [log]   - gamma: foo, bar
      [log]   - delta: foo"
    `);
  });
});

describe('getCatalogChangedPackages', () => {
  initMockLogs();

  let catalogFactory: RepositoryFactory;
  let _reusedRepo: Repository;
  let repo: Repository | undefined;

  /** Get the reused repo for this test type and create a new branch. */
  function getReusedRepoWithBranch() {
    repo = _reusedRepo;
    repo.checkoutTestBranch();
    return repo;
  }

  /**
   * Get changed files (only committed) and options, and call `getCatalogChangedPackages`.
   */
  function getCatalogChangedPackagesWrapper() {
    const parsedOptions = getParsedOptions({
      cwd: repo!.rootPath,
      argv: ['node', 'beachball', 'change'],
      env: {},
      testRepoOptions: { fetch: false, branch: defaultRemoteBranchName },
    });
    const { options } = parsedOptions;
    const packageInfos = getPackageInfos(parsedOptions);
    const scopedPackages = getScopedPackages(options, packageInfos);
    const changedFiles = getBranchChanges({ branch: options.branch, cwd: options.path }) || [];

    return getCatalogChangedPackages({
      options: parsedOptions.options,
      packageInfos,
      scopedPackages,
      allChangedFiles: new Set(changedFiles),
    });
  }

  beforeAll(() => {
    // Restore the real utilities so the catalog factory works end-to-end
    mockWorkspaceTools.getFileFromRef.mockImplementation(realWorkspaceTools.getFileFromRef);
    mockWorkspaceTools.getCatalogs.mockImplementation(realWorkspaceTools.getCatalogs);
    mockWorkspaceTools.getCatalogFilePath.mockImplementation(realWorkspaceTools.getCatalogFilePath);

    catalogFactory = new RepositoryFactory({
      tempDescription: 'catalog',
      rootPackage: { name: 'catalog-fixture', version: '1.0.0', private: true },
      folders: {
        packages: {
          alpha: { version: '1.0.0', dependencies: { foo: 'catalog:' } },
          plain: { version: '1.0.0' },
        },
      },
      extraFiles: { '.yarnrc.yml': catalogsToYaml(initialCatalogs) },
    });

    _reusedRepo = catalogFactory.cloneRepository();
  });

  afterEach(() => {
    repo = undefined;
    jest.clearAllMocks();
  });

  afterAll(() => {
    catalogFactory.cleanUp();
  });

  it('returns empty when the catalog file is unchanged', () => {
    repo = getReusedRepoWithBranch();
    repo.commitChange('packages/alpha/src/x.ts');

    expect(getCatalogChangedPackagesWrapper()).toEqual([]);
    // skipped the git step since there were no changes to the catalog file
    expect(mockWorkspaceTools.getFileFromRef).not.toHaveBeenCalled();
  });

  it('returns packages referencing a changed default catalog entry', () => {
    repo = getReusedRepoWithBranch();
    const updated: Catalogs = {
      default: { foo: '^1.5.0', baz: '^1.0.0' },
      named: initialCatalogs.named,
    };
    repo.commitChange('.yarnrc.yml', catalogsToYaml(updated));

    expect(getCatalogChangedPackagesWrapper()).toEqual(['alpha']);
    expect(mockWorkspaceTools.getFileFromRef).toHaveBeenCalled();
  });
});
