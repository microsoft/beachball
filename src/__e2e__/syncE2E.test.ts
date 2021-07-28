import fs from 'fs-extra';
import path from 'path';
import * as tmp from 'tmp';
import { sync } from '../commands/sync';
import { Registry } from '../fixtures/registry';
import { Repository, RepositoryFactory } from '../fixtures/repository';
import { getPackageInfos } from '../monorepo/getPackageInfos';
import { infoFromPackageJson } from '../monorepo/infoFromPackageJson';
import { packagePublish } from '../packageManager/packagePublish';

function createRepoPackage(repo: Repository, name: string, version: string) {
  const packageJson = {
    name: name,
    version: version,
  };

  repo.commitChange(`packages/${name}/package.json`, JSON.stringify(packageJson));
}

function createTempPackage(name: string, version: string, tag: string = 'latest') {
  const packageJsonFile = path.join(tmp.dirSync().name, 'package.json');
  const packageJson: any = {
    name: name,
    version: version,
    beachball: {
      tag,
    },
  };

  fs.writeJSONSync(packageJsonFile, packageJson, { spaces: 2 });
  return infoFromPackageJson(packageJson, packageJsonFile);
}

describe('sync command (e2e)', () => {
  const repositoryFactory = new RepositoryFactory();
  let registry: Registry;

  beforeAll(() => {
    registry = new Registry();
    jest.setTimeout(30000);
  });

  afterAll(() => {
    registry.stop();
  });

  beforeEach(async () => {
    await registry.reset();
    repositoryFactory.create();
  });

  afterEach(() => {
    repositoryFactory.cleanUp();
  });

  it('can perform a successful sync', async () => {
    const repo = repositoryFactory.cloneRepository();

    createRepoPackage(repo, 'foopkg', '1.0.0');
    createRepoPackage(repo, 'barpkg', '2.2.0');
    createRepoPackage(repo, 'bazpkg', '3.0.0');

    const packageInfosBeforeSync = getPackageInfos(repo.rootPath);

    expect(packagePublish(packageInfosBeforeSync['foopkg'], registry.getUrl(), '', '').success).toBeTruthy();
    expect(packagePublish(packageInfosBeforeSync['barpkg'], registry.getUrl(), '', '').success).toBeTruthy();

    const newFooInfo = createTempPackage('foopkg', '1.2.0');
    const newBarInfo = createTempPackage('barpkg', '3.0.0');

    expect(packagePublish(newFooInfo, registry.getUrl(), '', '').success).toBeTruthy();
    expect(packagePublish(newBarInfo, registry.getUrl(), '', '').success).toBeTruthy();

    await sync({
      all: false,
      authType: 'authtoken',
      branch: 'origin/master',
      command: 'sync',
      message: '',
      path: repo.rootPath,
      publish: false,
      bumpDeps: false,
      push: false,
      registry: registry.getUrl(),
      gitTags: false,
      tag: '',
      token: '',
      yes: true,
      new: false,
      access: 'public',
      package: '',
      changehint: 'Run "beachball change" to create a change file',
      type: null,
      fetch: true,
      disallowedChangeTypes: null,
      defaultNpmTag: 'latest',
      retries: 3,
      bump: false,
      generateChangelog: false,
      dependentChangeType: null,
    });

    const packageInfosAfterSync = getPackageInfos(repo.rootPath);

    expect(packageInfosAfterSync['foopkg'].version).toEqual('1.2.0');
    expect(packageInfosAfterSync['barpkg'].version).toEqual('3.0.0');
    expect(packageInfosAfterSync['bazpkg'].version).toEqual('3.0.0');
  });

  it('can perform a successful sync using dist tag', async () => {
    const repo = repositoryFactory.cloneRepository();

    createRepoPackage(repo, 'apkg', '1.0.0');
    createRepoPackage(repo, 'bpkg', '2.2.0');
    createRepoPackage(repo, 'cpkg', '3.0.0');

    const packageInfosBeforeSync = getPackageInfos(repo.rootPath);

    expect(packagePublish(packageInfosBeforeSync['apkg'], registry.getUrl(), '', '').success).toBeTruthy();
    expect(packagePublish(packageInfosBeforeSync['bpkg'], registry.getUrl(), '', '').success).toBeTruthy();

    const newFooInfo = createTempPackage('apkg', '2.0.0', 'beta');
    const newBarInfo = createTempPackage('bpkg', '3.0.0', 'latest');

    expect(packagePublish(newFooInfo, registry.getUrl(), '', '').success).toBeTruthy();
    expect(packagePublish(newBarInfo, registry.getUrl(), '', '').success).toBeTruthy();

    await sync({
      all: false,
      authType: 'authtoken',
      branch: 'origin/master',
      command: 'sync',
      message: '',
      path: repo.rootPath,
      publish: false,
      bumpDeps: false,
      push: false,
      registry: registry.getUrl(),
      gitTags: false,
      tag: 'beta',
      token: '',
      yes: true,
      new: false,
      access: 'public',
      package: '',
      changehint: 'Run "beachball change" to create a change file',
      type: null,
      fetch: true,
      disallowedChangeTypes: null,
      defaultNpmTag: 'latest',
      retries: 3,
      bump: false,
      generateChangelog: false,
      dependentChangeType: null,
    });

    const packageInfosAfterSync = getPackageInfos(repo.rootPath);

    expect(packageInfosAfterSync['apkg'].version).toEqual('2.0.0');
    expect(packageInfosAfterSync['bpkg'].version).toEqual('2.2.0');
    expect(packageInfosAfterSync['cpkg'].version).toEqual('3.0.0');
  });

  it('can perform a successful sync by forcing dist tag version', async () => {
    const repo = repositoryFactory.cloneRepository();

    createRepoPackage(repo, 'epkg', '1.0.0');
    createRepoPackage(repo, 'fpkg', '2.2.0');
    createRepoPackage(repo, 'gpkg', '3.0.0');

    const packageInfosBeforeSync = getPackageInfos(repo.rootPath);

    const epkg = packageInfosBeforeSync['epkg'];
    const fpkg = packageInfosBeforeSync['fpkg'];

    epkg.combinedOptions.tag = 'latest';
    fpkg.combinedOptions.tag = 'latest';

    expect(packagePublish(epkg, registry.getUrl(), '', '').success).toBeTruthy();
    expect(packagePublish(fpkg, registry.getUrl(), '', '').success).toBeTruthy();

    const newFooInfo = createTempPackage('epkg', '1.0.0-1');
    const newBarInfo = createTempPackage('fpkg', '3.0.0');

    newFooInfo.combinedOptions.tag = 'prerelease';
    newBarInfo.combinedOptions.tag = 'latest';

    expect(packagePublish(newFooInfo, registry.getUrl(), '', '').success).toBeTruthy();
    expect(packagePublish(newBarInfo, registry.getUrl(), '', '').success).toBeTruthy();

    await sync({
      all: false,
      authType: 'authtoken',
      branch: 'origin/master',
      command: 'sync',
      message: '',
      path: repo.rootPath,
      publish: false,
      bumpDeps: false,
      push: false,
      registry: registry.getUrl(),
      gitTags: false,
      tag: 'prerelease',
      token: '',
      yes: true,
      new: false,
      access: 'public',
      package: '',
      changehint: 'Run "beachball change" to create a change file',
      type: null,
      fetch: true,
      disallowedChangeTypes: null,
      defaultNpmTag: 'latest',
      retries: 3,
      bump: false,
      generateChangelog: false,
      forceVersions: true,
      dependentChangeType: null,
    });

    const packageInfosAfterSync = getPackageInfos(repo.rootPath);

    expect(packageInfosAfterSync['epkg'].version).toEqual('1.0.0-1');
    expect(packageInfosAfterSync['fpkg'].version).toEqual('2.2.0');
    expect(packageInfosAfterSync['gpkg'].version).toEqual('3.0.0');
  });
});
