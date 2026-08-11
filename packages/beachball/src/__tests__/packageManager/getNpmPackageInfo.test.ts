import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { initMockLogs } from '@microsoft/beachball-test-utilities';
import { initNpmMock } from '../../__fixtures__/mockNpm';
import { _packageContentTypeAccept, getNpmPackageInfo } from '../../packageManager/getNpmPackageInfo';

jest.mock('../../packageManager/npm');

describe('getNpmPackageInfo (mocked)', () => {
  const npmMock = initNpmMock();
  const logs = initMockLogs();
  const registry = 'https://registry.test/base';
  const options = { registry, path: '', timeout: 25 };

  it('fetches and validates an exact package manifest', async () => {
    // use a weird version to validate encoding (tags may not contain chars requiring encoding)
    const version = '1.0.0-alpha+001';
    npmMock.setRegistryData({ '@scope/pkg': { versions: ['1.0.0', version, '2.0.0'] } });

    const result = await getNpmPackageInfo('@scope/pkg', version, options);
    expect(result).toEqual({ name: '@scope/pkg', version: version });
    expect(npmMock.mockFetch).toHaveBeenCalledWith(
      new URL(registry + '/%40scope%2Fpkg/' + encodeURIComponent(version)),
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it('passes auth args', async () => {
    // Don't care about the result in this case
    await getNpmPackageInfo('foo', '1.0.0', { ...options, token: 'fake' });

    expect(npmMock.mockFetch).toHaveBeenCalledTimes(1);
    expect(npmMock.mockFetch).toHaveBeenCalledWith(new URL(registry + '/foo/1.0.0'), {
      headers: {
        Accept: _packageContentTypeAccept,
        Authorization: 'Bearer fake',
      },
      signal: expect.anything(),
    });
  });

  it('returns undefined without warning for a missing manifest', async () => {
    expect(await getNpmPackageInfo('foo', '1.0.0', { ...options, verbose: true })).toBeUndefined();
    expect(npmMock.mockFetch).toHaveBeenCalledTimes(1);
    expect(logs.mocks.warn).not.toHaveBeenCalled();
  });

  describe('retries', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });
    afterEach(() => {
      jest.useRealTimers();
    });

    it.each([408, 429, 500, 503])('retries transient HTTP status %s', async status => {
      npmMock.setRegistryData({ foo: { versions: ['1.0.0'] } });
      npmMock.mockFetch.mockResolvedValueOnce(new Response(undefined, { status }));

      const resultPromise = getNpmPackageInfo('foo', '1.0.0', options);
      await jest.runAllTimersAsync();

      expect(await resultPromise).toEqual({ name: 'foo', version: '1.0.0' });
      expect(npmMock.mockFetch).toHaveBeenCalledTimes(2);
    });

    it('retries a fetch failure', async () => {
      npmMock.setRegistryData({ foo: { versions: ['1.0.0'] } });
      npmMock.mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'));

      const resultPromise = getNpmPackageInfo('foo', '1.0.0', options);
      await jest.runAllTimersAsync();

      expect(await resultPromise).toEqual({ name: 'foo', version: '1.0.0' });
      expect(npmMock.mockFetch).toHaveBeenCalledTimes(2);
    });

    it('stops after three retries', async () => {
      npmMock.mockFetch.mockResolvedValue(new Response(undefined, { status: 503 }));

      const resultPromise = getNpmPackageInfo('foo', '1.0.0', options);
      await jest.runAllTimersAsync();

      expect(await resultPromise).toBeUndefined();
      expect(npmMock.mockFetch).toHaveBeenCalledTimes(4);
    });
  });

  it.each([400, 409])('does not retry non-auth HTTP status %s', async status => {
    npmMock.mockFetch.mockResolvedValue(new Response(undefined, { status }));

    expect(await getNpmPackageInfo('foo', '1.0.0', options)).toBeUndefined();
    expect(npmMock.mockFetch).toHaveBeenCalledTimes(1);
  });

  it.each([401, 403])('throws without retrying auth HTTP status %s', async status => {
    npmMock.mockFetch.mockResolvedValue(new Response(undefined, { status }));

    await expect(getNpmPackageInfo('foo', '1.0.0', options)).rejects.toThrow(
      `Getting info about "foo@1.0.0" failed: ${status}`
    );
    expect(npmMock.mockFetch).toHaveBeenCalledTimes(1);
  });

  it('does not retry an invalid successful response', async () => {
    npmMock.mockFetch.mockResolvedValue(new Response(JSON.stringify({ name: 'foo' }), { status: 200 }));

    expect(await getNpmPackageInfo('foo', '1.0.0', options)).toBeUndefined();
    expect(npmMock.mockFetch).toHaveBeenCalledTimes(1);
  });
});
