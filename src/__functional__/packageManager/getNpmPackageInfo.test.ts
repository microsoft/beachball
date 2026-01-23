import { describe, expect, it, afterAll, beforeEach, jest } from '@jest/globals';
// import fetch from 'npm-registry-fetch';
import {
  _npmShowProperties,
  _packageContentTypeAccept,
  getNpmPackageInfo,
} from '../../packageManager/getNpmPackageInfo';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import * as npmModule from '../../packageManager/npm';

describe('getNpmPackageInfo', () => {
  const npmSpy = jest.spyOn(npmModule, 'npm');
  // const fetchJsonSpy = jest.spyOn(fetch, 'json');
  const logs = initMockLogs();
  // These tests mostly get known packages from the public npm registry.
  // There's a tiny chance it could fail if the registry is down, but beachball's developer traffic
  // is low enough that it doesn't really matter.
  const registry = 'https://registry.npmjs.org/';
  /** In the unlikely event that somebody publishes this package, it can be changed to different nonsense */
  const shouldNotExist = 'asdfsdfsadfsafsafdsafsdfsdafsfsdfsdafsadfsdfsdfasdfsaf';

  beforeEach(() => {
    npmSpy.mockClear();
    // fetchJsonSpy.mockClear();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it.each<{ desc: string; name: string; knownVersion: string }>([
    { desc: 'unscoped', name: 'beachball', knownVersion: '2.60.1' },
    { desc: 'scoped', name: '@lage-run/cli', knownVersion: '0.33.0' },
  ])('gets info for $desc package from public npm registry', async ({ name, knownVersion }) => {
    const timeout = 10000;
    const result = await getNpmPackageInfo(name, { registry, timeout, path: undefined });

    expect(npmSpy).toHaveBeenCalledTimes(1);
    // Verify args format
    expect(npmSpy).toHaveBeenCalledWith(
      ['show', '--registry', registry, '--json', name, ..._npmShowProperties],
      expect.objectContaining({ timeout, cwd: undefined })
    );
    // Verify output format (there's no toHaveResolvedWith matcher, so await the return value)
    expect(await npmSpy.mock.results[0].value).toMatchObject({
      success: true,
      // should have JSON of an array of versions
      stdout: expect.stringMatching(/"versions":\s?\[/),
    });

    // expect(fetchJsonSpy).toHaveBeenCalledTimes(1);
    // // Verify args format
    // expect(fetchJsonSpy).toHaveBeenCalledWith(`/${encodeURIComponent(name)}`, {
    //   headers: { accept: _packageContentTypeAccept },
    //   registry,
    //   timeout,
    // });
    // // Verify API return value format (there's no toHaveResolvedWith matcher, so await the return value)
    // expect(await fetchJsonSpy.mock.results[0].value).toEqual({
    //   name,
    //   modified: expect.any(String),
    //   versions: expect.objectContaining({
    //     [knownVersion]: expect.objectContaining({ name, version: knownVersion }),
    //   }),
    //   'dist-tags': expect.objectContaining({ latest: expect.any(String) }),
    // });

    // Verify processed result
    expect(result).toEqual({
      versions: expect.arrayContaining([knownVersion]),
      'dist-tags': expect.objectContaining({ latest: expect.any(String) }),
    });
  });

  it('returns undefined for nonexistent package', async () => {
    const result = await getNpmPackageInfo(shouldNotExist, { registry, verbose: true, path: '' });
    expect(result).toBeUndefined();

    expect(npmSpy).toHaveBeenCalledTimes(1);
    // npm show failed
    expect(await npmSpy.mock.results[0].value).toMatchObject({
      success: false,
      stderr: expect.stringMatching('404'),
    });
    // expect(fetchJsonSpy).toHaveBeenCalledTimes(1);
    // // The fetch call rejected with a 404 error
    // await expect(fetchJsonSpy.mock.results[0].value).rejects.toThrow('404');

    // There's a warning with verbose logging
    expect(logs.mocks.warn).toHaveBeenCalledTimes(1);
    expect(logs.mocks.warn).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`Failed to get or parse npm info for ${shouldNotExist}:[\\s\\S]*?404`))
    );
  });

  it('passes auth args', async () => {
    // Don't care about the result in this case
    await getNpmPackageInfo(shouldNotExist, { registry, token: 'fake', path: undefined });

    expect(npmSpy).toHaveBeenCalledTimes(1);
    expect(npmSpy).toHaveBeenCalledWith(
      [
        'show',
        '--registry',
        registry,
        '--json',
        '--//registry.npmjs.org/:_authToken=fake',
        shouldNotExist,
        ..._npmShowProperties,
      ],
      expect.anything()
    );

    // expect(fetchJsonSpy).toHaveBeenCalledTimes(1);
    // expect(fetchJsonSpy).toHaveBeenCalledWith('/' + shouldNotExist, {
    //   registry,
    //   headers: { accept: _packageContentTypeAccept },
    //   alwaysAuth: true,
    //   '//registry.npmjs.org/:_authToken': 'fake',
    // });
    // No warning since verbose wasn't enabled
    expect(logs.mocks.warn).not.toHaveBeenCalled();
  });
});
