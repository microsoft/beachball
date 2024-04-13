import { describe, expect, it, beforeAll, afterAll, beforeEach, jest, afterEach } from '@jest/globals';
import fs from 'fs-extra';
import path from 'path';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import { npmShow } from '../../__fixtures__/npmShow';
import { Registry } from '../../__fixtures__/registry';
import { tmpdir } from '../../__fixtures__/tmpdir';
import * as npmModule from '../../packageManager/npm';
import { packagePublish } from '../../packageManager/packagePublish';
import { PackageInfo } from '../../types/PackageInfo';
import { npm, NpmResult } from '../../packageManager/npm';

const testTag = 'testbeachballtag';
const testName = 'testbeachballpackage';
const testVersion = '0.6.0';
const testSpec = `${testName}@${testVersion}`;
const testPackage = { name: testName, version: testVersion };

//
// Some of these tests use an actual local npm registry, so they're slower to run.
// The rest mock npm calls for efficiency (but could potentially be updated to use real npm if
// a bug is found that would have been caught that way).
//
describe('packagePublish', () => {
  let npmSpy: jest.SpiedFunction<typeof npm>;
  /**
   * Actual local npm registry.
   * NOTE: tests using the registry must call `await registry.reset()` at the start.
   * (This is not done in beforeEach because it's a bit slow, and not all tests use the registry.)
   */
  let registry: Registry;
  let tempRoot: string;
  let tempPackageJsonPath: string;
  /**
   * Test publish results against this object so that any output will show up in the logs if there
   * are errors (otherwise it's hard to debug).
   */
  const successResult = expect.objectContaining({ success: true });
  const failedResult = expect.objectContaining({ success: false });

  const logs = initMockLogs();

  function getTestPackageInfo(): PackageInfo {
    return {
      ...testPackage,
      packageJsonPath: tempPackageJsonPath,
      private: false,
      combinedOptions: {
        gitTags: true,
        tag: testTag,
        defaultNpmTag: 'latest',
        disallowedChangeTypes: [],
      },
      packageOptions: {} as any,
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

  beforeEach(() => {
    npmSpy = jest.spyOn(npmModule, 'npm');
  });

  afterEach(() => {
    npmSpy.mockRestore();
  });

  afterAll(() => {
    registry.stop();
    fs.removeSync(tempRoot);
  });

  it('can publish', async () => {
    // Do a basic publishing test against the real registry
    await registry.reset();
    const testPackageInfo = getTestPackageInfo();
    const publishResult = await packagePublish(testPackageInfo, { registry: registry.getUrl(), retries: 2 });
    expect(publishResult).toEqual(successResult);
    expect(npmSpy).toHaveBeenCalledTimes(1);

    const allLogs = logs.getMockLines('all');
    expect(allLogs).toMatch(`Publishing - ${testSpec} with tag ${testTag}`);
    expect(allLogs).toMatch('publish command:');
    expect(allLogs).toMatch(`[log] Published!`);

    expect(await npmShow(testName, { registry })).toMatchObject({
      name: testName,
      versions: [testVersion],
      // This will publish the test tag as well as "latest" because it's a new package
      'dist-tags': { [testTag]: testVersion, latest: testVersion },
    });
  });

  it('does not publish if dryRun is specified', async () => {
    // This might be redundant to test, but we want to be very sure we're passing the right option
    // to npm here to avoid accidental publishing.
    await registry.reset();
    const testPackageInfo = getTestPackageInfo();
    const publishResult = await packagePublish(testPackageInfo, {
      dryRun: true,
      registry: registry.getUrl(),
      retries: 2,
    });
    expect(publishResult).toEqual(successResult);
    expect(npmSpy).toHaveBeenCalledTimes(1);

    const allLogs = logs.getMockLines('all');
    expect(allLogs).toMatch(`Publishing - ${testSpec} with tag ${testTag}`);
    expect(allLogs).toMatch('publish command:');
    expect(allLogs).toMatch(`[log] Published!`);

    // version shouldn't exist
    await npmShow(testName, { registry, shouldFail: true });
  });

  it('errors and does not retry on republish', async () => {
    // Use real npm for this because the republish detection relies on the real error message
    await registry.reset();
    const testPackageInfo = getTestPackageInfo();
    let publishResult = await packagePublish(testPackageInfo, { registry: registry.getUrl(), retries: 2 });
    expect(publishResult).toEqual(successResult);
    expect(npmSpy).toHaveBeenCalledTimes(1);
    logs.clear();

    publishResult = await packagePublish(testPackageInfo, { registry: registry.getUrl(), retries: 2 });
    expect(publishResult).toEqual(failedResult);
    // `retries` should be ignored if the version already exists
    expect(npmSpy).toHaveBeenCalledTimes(2);

    const logs2ndTry = logs.getMockLines('all');
    expect(logs2ndTry).toMatch(`${testSpec} already exists in the registry`);
  });

  it('performs retries', async () => {
    // It's difficult or not desirable to simulate actual error conditions (such as timeouts or network errors),
    // so mock all npm calls for this test.
    const testPackageInfo = getTestPackageInfo();
    // mock success by default, except for the two mocked failures below
    npmSpy.mockImplementation(() => Promise.resolve({ success: true } as NpmResult));
    // first call: arbitrary error
    npmSpy.mockImplementationOnce(() => Promise.resolve({ success: false, all: 'some errors' } as NpmResult));
    // second call: timeout
    npmSpy.mockImplementationOnce(() =>
      Promise.resolve({ success: false, all: 'sloooow', timedOut: true } as NpmResult)
    );

    const publishResult = await packagePublish(testPackageInfo, { registry: 'fake', retries: 3 });
    expect(publishResult).toEqual(successResult);
    expect(npmSpy).toHaveBeenCalledTimes(3);

    const allLogs = logs.getMockLines('all');
    expect(allLogs).toMatch(`[warn] Publishing ${testSpec} failed. Output:\n\nsome errors`);
    expect(allLogs).toMatch('Retrying... (1/3)');
    expect(allLogs).toMatch(`[warn] Publishing ${testSpec} failed (timed out). Output:\n\nsloooow`);
    expect(allLogs).toMatch('Retrying... (2/3)');
    expect(allLogs).toMatch(`[log] Published!`);
  });

  it('fails if out of retries', async () => {
    // Again, mock all npm calls for this test instead of simulating an actual error condition.
    npmSpy.mockImplementation(() => Promise.resolve({ success: false, all: 'some errors' } as NpmResult));

    const publishResult = await packagePublish(getTestPackageInfo(), { registry: 'fake', retries: 3 });
    expect(publishResult).toEqual(failedResult);
    expect(npmSpy).toHaveBeenCalledTimes(4);

    const allLogs = logs.getMockLines('all');
    expect(allLogs).toMatch('Retrying... (1/3)');
    expect(allLogs).toMatch('Retrying... (2/3)');
    expect(allLogs).toMatch('Retrying... (3/3)');
    expect(allLogs).toMatch(`[error] Publishing ${testSpec} failed. Output:\n\nsome errors`);
  });

  it('does not retry on auth error', async () => {
    // Mock an auth error
    const testPackageInfo = getTestPackageInfo();
    npmSpy.mockImplementation(() => Promise.resolve({ success: false, all: 'ERR! code ENEEDAUTH' } as NpmResult));

    const publishResult = await packagePublish(testPackageInfo, { registry: 'fake', retries: 3 });
    expect(publishResult).toEqual(failedResult);
    expect(npmSpy).toHaveBeenCalledTimes(1);

    expect(logs.getMockLines('error')).toMatch(
      `Publishing ${testSpec} failed due to an auth error. Output:\n\nERR! code ENEEDAUTH`
    );
  });

  it('does not retry on E404', async () => {
    // E404 most commonly indicates an issue with a token, which is hard to simulate,
    // so just mock the npm call.
    const testPackageInfo = getTestPackageInfo();
    npmSpy.mockImplementation(() => Promise.resolve({ success: false, all: 'ERR! code E404' } as NpmResult));

    const publishResult = await packagePublish(testPackageInfo, { registry: 'fake', retries: 3 });
    expect(publishResult).toEqual(failedResult);
    expect(npmSpy).toHaveBeenCalledTimes(1);

    expect(logs.getMockLines('error')).toMatch(`Publishing ${testSpec} failed with E404`);
  });

  it('does not retry on E403', async () => {
    const testPackageInfo = getTestPackageInfo();
    npmSpy.mockImplementation(() => Promise.resolve({ success: false, all: 'ERR! code E403' } as NpmResult));

    const publishResult = await packagePublish(testPackageInfo, { registry: 'fake', retries: 3 });
    expect(publishResult).toEqual(failedResult);
    expect(npmSpy).toHaveBeenCalledTimes(1);

    expect(logs.getMockLines('error')).toMatch(`Publishing ${testSpec} failed due to a 403 error`);
  });
});
