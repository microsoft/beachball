import { describe, expect, it, beforeAll, afterAll, beforeEach, jest, afterEach } from '@jest/globals';
import path from 'path';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import { Registry } from '../../__fixtures__/registry';
import { removeTempDir, tmpdir } from '../../__fixtures__/tmpdir';
import * as npmModule from '../../packageManager/npm';
import { packagePublish } from '../../packageManager/packagePublish';
import type { PackageInfo } from '../../types/PackageInfo';
import type { npm, NpmResult } from '../../packageManager/npm';
import { writeJson } from '../../object/writeJson';
import { getNpmPackageInfo, type NpmPackageVersionsData } from '../../packageManager/getNpmPackageInfo';
import { env } from '../../env';

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

  const defaultOptions: Omit<Parameters<typeof packagePublish>[1], 'path' | 'registry'> = {
    npmReadConcurrency: 2,
    retries: 3,
  };

  function getTestPackageInfo(): PackageInfo {
    return {
      ...testPackage,
      packageJsonPath: tempPackageJsonPath,
      packageOptions: { tag: testTag },
    };
  }

  function getRealNpmPackageInfo(packageName: string): Promise<NpmPackageVersionsData | undefined> {
    return getNpmPackageInfo(packageName, {
      registry: registry.getUrl(),
      // Probably less important now that this is a fetch not a shell command, but just in case
      timeout: env.isCI && process.platform === 'win32' ? 4500 : 1500,
    });
  }

  beforeAll(() => {
    registry = new Registry(__filename);

    // Create a test package.json in a temporary location for use in tests.
    tempRoot = tmpdir();
    tempPackageJsonPath = path.join(tempRoot, 'package.json');
    writeJson(tempPackageJsonPath, testPackage);
  });

  beforeEach(() => {
    npmSpy = jest.spyOn(npmModule, 'npm');
  });

  afterEach(() => {
    npmSpy.mockRestore();
  });

  afterAll(() => {
    registry.stop();
    registry.cleanUp();
    removeTempDir(tempRoot);
  });

  it('can publish', async () => {
    // Do a basic publishing test against the real registry
    await registry.reset();
    const testPackageInfo = getTestPackageInfo();
    const publishResult = await packagePublish(testPackageInfo, {
      ...defaultOptions,
      registry: registry.getUrl(),
      path: tempRoot,
    });
    expect(publishResult).toEqual(successResult);
    expect(npmSpy).toHaveBeenCalledTimes(1);

    const allLogs = logs.getMockLines('all');
    expect(allLogs).toMatch(`Publishing - ${testSpec} with tag ${testTag}`);
    expect(allLogs).toMatch('publish command:');
    expect(allLogs).toMatch(`[log] Published!`);

    expect(await getRealNpmPackageInfo(testName)).toEqual({
      versions: [testVersion],
      // This will publish the test tag as well as "latest" because it's a new package
      'dist-tags': { [testTag]: testVersion, latest: testVersion },
    });
  });

  it('errors and does not retry on republish', async () => {
    // Use real npm for this because the republish detection relies on the real error message
    await registry.reset();
    const testPackageInfo = getTestPackageInfo();
    const options = { ...defaultOptions, registry: registry.getUrl(), path: tempRoot };

    let publishResult = await packagePublish(testPackageInfo, options);
    expect(publishResult).toEqual(successResult);
    expect(npmSpy).toHaveBeenCalledTimes(1);
    logs.clear();

    publishResult = await packagePublish(testPackageInfo, options);
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

    const publishResult = await packagePublish(testPackageInfo, {
      ...defaultOptions,
      registry: 'fake',
      path: tempRoot,
    });
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

    const publishResult = await packagePublish(getTestPackageInfo(), {
      ...defaultOptions,
      registry: 'fake',
      path: tempRoot,
    });
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

    const publishResult = await packagePublish(testPackageInfo, {
      ...defaultOptions,
      registry: 'fake',
      path: tempRoot,
    });
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

    const publishResult = await packagePublish(testPackageInfo, {
      ...defaultOptions,
      registry: 'fake',
      path: tempRoot,
    });
    expect(publishResult).toEqual(failedResult);
    expect(npmSpy).toHaveBeenCalledTimes(1);

    expect(logs.getMockLines('error')).toMatch(`Publishing ${testSpec} failed with E404`);
  });

  it('does not retry on E403', async () => {
    const testPackageInfo = getTestPackageInfo();
    npmSpy.mockImplementation(() => Promise.resolve({ success: false, all: 'ERR! code E403' } as NpmResult));

    const publishResult = await packagePublish(testPackageInfo, {
      ...defaultOptions,
      registry: 'fake',
      path: tempRoot,
    });
    expect(publishResult).toEqual(failedResult);
    expect(npmSpy).toHaveBeenCalledTimes(1);

    expect(logs.getMockLines('error')).toMatch(`Publishing ${testSpec} failed due to a 403 error`);
  });
});
