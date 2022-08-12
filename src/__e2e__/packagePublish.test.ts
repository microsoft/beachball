import fs from 'fs-extra';
import path from 'path';
import { initMockLogs } from '../__fixtures__/mockLogs';
import { Registry } from '../__fixtures__/registry';
import { tmpdir } from '../__fixtures__/tmpdir';
import { packagePublish } from '../packageManager/packagePublish';
import { npm } from '../packageManager/npm';
import { PackageInfo } from '../types/PackageInfo';

const testTag = 'testbeachballtag';
const testName = 'testbeachballpackage';
const testVersion = '0.6.0';
const testPackage = { name: testName, version: testVersion };

describe('packagePublish', () => {
  let registry: Registry;
  let tempRoot: string;
  let tempPackageJsonPath: string;

  initMockLogs();

  function getTestPackageInfo(tag: string | null, defaultNpmTag = 'latest'): PackageInfo {
    return {
      ...testPackage,
      packageJsonPath: tempPackageJsonPath,
      private: false,
      combinedOptions: {
        gitTags: true,
        tag,
        defaultNpmTag,
        disallowedChangeTypes: [],
      },
      packageOptions: {
        gitTags: true,
        tag,
        defaultNpmTag,
        disallowedChangeTypes: [],
      },
    };
  }

  beforeAll(() => {
    registry = new Registry();
    jest.setTimeout(30000);

    // Create a test package.json in a temporary location for use in tests.
    tempRoot = tmpdir();
    tempPackageJsonPath = path.join(tempRoot, 'package.json');
    fs.writeJSONSync(tempPackageJsonPath, testPackage, { spaces: 2 });
  });

  beforeEach(async () => {
    await registry.reset();
  });

  afterAll(() => {
    registry.stop();
    fs.removeSync(tempRoot);
  });

  it('can publish', async () => {
    const testPackageInfo = getTestPackageInfo(testTag);
    const publishResult = await packagePublish(testPackageInfo, registry.getUrl(), '', '');
    expect(publishResult.success).toBeTruthy();

    const showResult = npm(['--registry', registry.getUrl(), 'show', testPackageInfo.name, '--json']);
    expect(showResult.success).toBeTruthy();

    const show = JSON.parse(showResult.stdout);
    expect(show.name).toEqual(testPackageInfo.name);
    expect(show['dist-tags'][testTag]).toEqual(testPackageInfo.version);
    expect(show.versions.length).toEqual(1);
    expect(show.versions[0]).toEqual(testPackageInfo.version);
  });

  it('errors on republish', async () => {
    const testPackageInfo = getTestPackageInfo(testTag);
    let publishResult = await packagePublish(testPackageInfo, registry.getUrl(), '', '');
    expect(publishResult.success).toBeTruthy();

    publishResult = await packagePublish(testPackageInfo, registry.getUrl(), '', '');
    expect(publishResult.success).toBeFalsy();
  });

  it('publish with no tag publishes latest', async () => {
    const testPackageInfo = getTestPackageInfo(null);
    const publishResult = await packagePublish(testPackageInfo, registry.getUrl(), '', '');
    expect(publishResult.success).toBeTruthy();

    const showResult = npm(['--registry', registry.getUrl(), 'show', testPackageInfo.name, '--json']);
    expect(showResult.success).toBeTruthy();

    const show = JSON.parse(showResult.stdout);
    expect(show.name).toEqual(testPackageInfo.name);
    expect(show['dist-tags']['latest']).toEqual(testPackageInfo.version);
    expect(show.versions.length).toEqual(1);
    expect(show.versions[0]).toEqual(testPackageInfo.version);
  });

  it('publish package with defaultNpmTag publishes as defaultNpmTag', async () => {
    const testPackageInfoWithDefaultNpmTag = getTestPackageInfo(null, testTag);
    const publishResult = await packagePublish(testPackageInfoWithDefaultNpmTag, registry.getUrl(), '', '');
    expect(publishResult.success).toBeTruthy();

    const showResult = npm(['--registry', registry.getUrl(), 'show', testPackageInfoWithDefaultNpmTag.name, '--json']);
    expect(showResult.success).toBeTruthy();

    const show = JSON.parse(showResult.stdout);
    expect(show.name).toEqual(testPackageInfoWithDefaultNpmTag.name);
    expect(show['dist-tags'][testTag]).toEqual(testPackageInfoWithDefaultNpmTag.version);
    expect(show.versions.length).toEqual(1);
    expect(show.versions[0]).toEqual(testPackageInfoWithDefaultNpmTag.version);
  });

  it('publish with specified tag overrides defaultNpmTag', async () => {
    const testPackageInfoWithDefaultNpmTag = getTestPackageInfo(testTag, 'thisShouldNotBeUsed');
    const publishResult = await packagePublish(testPackageInfoWithDefaultNpmTag, registry.getUrl(), '', '');
    expect(publishResult.success).toBeTruthy();

    const showResult = npm(['--registry', registry.getUrl(), 'show', testPackageInfoWithDefaultNpmTag.name, '--json']);
    expect(showResult.success).toBeTruthy();

    const show = JSON.parse(showResult.stdout);
    expect(show.name).toEqual(testPackageInfoWithDefaultNpmTag.name);
    expect(show['dist-tags'][testTag]).toEqual(testPackageInfoWithDefaultNpmTag.version);
    expect(show.versions.length).toEqual(1);
    expect(show.versions[0]).toEqual(testPackageInfoWithDefaultNpmTag.version);
  });
});
