import { describe, expect, it, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import fs from 'fs-extra';
import path from 'path';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import { npmShow, NpmShowResult } from '../../__fixtures__/npmShow';
import { Registry } from '../../__fixtures__/registry';
import { tmpdir } from '../../__fixtures__/tmpdir';
import { packagePublish } from '../../packageManager/packagePublish';
import { PackageInfo } from '../../types/PackageInfo';

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
    registry = new Registry(__filename);
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
    // Check the result like this so any output will show up in the logs if there are errors
    // (hard to debug otherwise)
    expect(publishResult).toEqual(expect.objectContaining({ success: true }));

    const expectedNpmResult: NpmShowResult = {
      name: testName,
      versions: [testVersion],
      // This will publish the test tag as well as "latest" because it's a new package
      'dist-tags': { [testTag]: testVersion, latest: testVersion },
    };
    expect(npmShow(registry, testName)).toMatchObject(expectedNpmResult);
  });

  it('errors on republish', async () => {
    const testPackageInfo = getTestPackageInfo(testTag);
    let publishResult = await packagePublish(testPackageInfo, registry.getUrl(), '', '');
    expect(publishResult).toEqual(expect.objectContaining({ success: true })); // see comment on first test

    publishResult = await packagePublish(testPackageInfo, registry.getUrl(), '', '');
    expect(publishResult.success).toBeFalsy();
  });

  it('publish with no tag publishes latest', async () => {
    const testPackageInfo = getTestPackageInfo(null);
    const publishResult = await packagePublish(testPackageInfo, registry.getUrl(), '', '');
    expect(publishResult).toEqual(expect.objectContaining({ success: true })); // see comment on first test

    const expectedNpmResult: NpmShowResult = {
      name: testName,
      versions: [testVersion],
      'dist-tags': { latest: testVersion },
    };
    expect(npmShow(registry, testName)).toMatchObject(expectedNpmResult);
  });

  it('publish package with defaultNpmTag publishes as defaultNpmTag', async () => {
    const testPackageInfoWithDefaultNpmTag = getTestPackageInfo(null, testTag);
    const publishResult = await packagePublish(testPackageInfoWithDefaultNpmTag, registry.getUrl(), '', '');
    expect(publishResult).toEqual(expect.objectContaining({ success: true })); // see comment on first test

    const expectedNpmResult: NpmShowResult = {
      name: testName,
      versions: [testVersion],
      'dist-tags': { [testTag]: testVersion, latest: testVersion },
    };
    expect(npmShow(registry, testName)).toMatchObject(expectedNpmResult);
  });

  it('publish with specified tag overrides defaultNpmTag', async () => {
    const testPackageInfoWithDefaultNpmTag = getTestPackageInfo(testTag, 'thisShouldNotBeUsed');
    const publishResult = await packagePublish(testPackageInfoWithDefaultNpmTag, registry.getUrl(), '', '');
    expect(publishResult).toEqual(expect.objectContaining({ success: true })); // see comment on first test

    const expectedNpmResult: NpmShowResult = {
      name: testName,
      versions: [testVersion],
      'dist-tags': { [testTag]: testVersion, latest: testVersion },
    };
    expect(npmShow(registry, testName)).toMatchObject(expectedNpmResult);
  });
});
