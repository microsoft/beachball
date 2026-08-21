import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { expectError } from '@microsoft/beachball-test-utilities';
import { getReleaseDetails, getReleaseStatus, submitRelease } from '../esrpApi/releaseHttp.ts';
import type { ReleaseRequestMessage } from '../types/api.ts';
import { ReleaseError } from '../utils/ReleaseError.ts';

describe('releaseHttp', () => {
  let fetchMock: jest.Mock<typeof fetch>;
  const originalFetch = globalThis.fetch;

  const baseUrl = 'https://api.esrp.microsoft.com/api/v3/releaseservices/clients/';

  const mockRequest = { driEmail: ['example@example.com'] } as ReleaseRequestMessage;
  const defaultParams = { clientId: 'cid', bearerToken: 'tok' };
  const defaultGetParams = { ...defaultParams, releaseId: 'rid' };

  function makeFetchResponse(opts: { status?: number; ok?: boolean; body: string }): Response {
    const status = opts.status ?? 200;
    const ok = opts.ok ?? (status >= 200 && status < 300);
    return {
      ok,
      status,
      text: () => Promise.resolve(opts.body),
    } as Response;
  }

  beforeEach(() => {
    fetchMock = jest.fn<typeof fetch>();
    globalThis.fetch = fetchMock;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('submitRelease', () => {
    it('POSTs to operations endpoint with content-type, JSON body, and parses response', async () => {
      fetchMock.mockResolvedValue(makeFetchResponse({ body: '{"operationId":"op-1"}' }));

      const result = await submitRelease({ ...defaultParams, releaseRequest: mockRequest });

      expect(result).toEqual({ operationId: 'op-1' });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}cid/workflows/release/operations`, {
        method: 'POST',
        headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
        body: JSON.stringify(mockRequest),
        signal: expect.anything(),
      });
    });

    it.each([
      ['a transient HTTP response', () => makeFetchResponse({ status: 503, body: 'unavailable' })],
      ['a network error', () => Promise.reject(new Error('fetch failed'))],
    ])('does not retry or mark %s as retryable', async (_description, getFailure) => {
      jest.useFakeTimers();
      fetchMock.mockImplementation(() => Promise.resolve(getFailure()).then(result => result));

      const error = (await expectError(
        submitRelease({ ...defaultParams, releaseRequest: mockRequest }),
        ReleaseError,
        'Failed to submit release'
      )) as ReleaseError;

      expect(error.retryable).toBe(false);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('getReleaseStatus', () => {
    it('GETs the grs endpoint and parses response', async () => {
      fetchMock.mockResolvedValue(makeFetchResponse({ body: '{"status":"pass"}' }));

      const result = await getReleaseStatus(defaultGetParams);

      expect(result).toEqual({ status: 'pass' });
      expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}cid/workflows/release/operations/grs/rid`, {
        method: 'GET',
        headers: { Authorization: 'Bearer tok' },
        signal: expect.anything(),
      });
    });
  });

  describe('getReleaseDetails', () => {
    it('GETs the grd endpoint and parses response', async () => {
      fetchMock.mockResolvedValue(makeFetchResponse({ body: '{"foo":"bar"}' }));

      const result = await getReleaseDetails(defaultGetParams);

      expect(result).toEqual({ foo: 'bar' });
      expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}cid/workflows/release/operations/grd/rid`, {
        method: 'GET',
        headers: { Authorization: 'Bearer tok' },
        signal: expect.anything(),
      });
    });

    it('retries transient failures up to three attempts', async () => {
      jest.useFakeTimers();
      fetchMock
        .mockResolvedValueOnce(makeFetchResponse({ status: 503, body: 'unavailable' }))
        .mockRejectedValueOnce(new Error('fetch failed'))
        .mockResolvedValueOnce(makeFetchResponse({ body: '{"foo":"bar"}' }));

      const promise = getReleaseDetails(defaultGetParams);
      await jest.runAllTimersAsync();

      await expect(promise).resolves.toEqual({ foo: 'bar' });
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });
  });

  describe('error handling', () => {
    it('throws immediately on non-transient HTTP status, including status and body in message', async () => {
      fetchMock.mockResolvedValue(makeFetchResponse({ status: 403, body: 'auth error' }));

      const err = (await expectError(
        getReleaseStatus(defaultGetParams),
        ReleaseError,
        'Failed to get release status',
        /failed with status 403[\s\S]*auth error/
      )) as ReleaseError;

      expect(err.retryable).toBe(false);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('marks a transient HTTP status as retryable without retrying', async () => {
      fetchMock.mockResolvedValue(makeFetchResponse({ status: 500, body: 'internal server error' }));

      const err = (await expectError(
        getReleaseStatus(defaultGetParams),
        ReleaseError,
        'Failed to get release status',
        /failed after 1 attempt[\s\S]*status 500[\s\S]*internal server error/
      )) as ReleaseError;

      expect(err.retryable).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('throws when response body is not valid JSON', async () => {
      fetchMock.mockResolvedValue(makeFetchResponse({ body: 'not json' }));

      const err = (await expectError(
        getReleaseStatus(defaultGetParams),
        ReleaseError,
        'Failed to get release status',
        /did not return valid JSON[\s\S]*not json/
      )) as ReleaseError;

      expect(err.retryable).toBe(false);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('marks an aborted request as retryable without retrying', async () => {
      jest.useFakeTimers();
      jest.spyOn(AbortSignal, 'timeout').mockImplementation(milliseconds => {
        const controller = new AbortController();
        setTimeout(() => controller.abort(new DOMException('Request timed out', 'TimeoutError')), milliseconds);
        return controller.signal;
      });
      fetchMock.mockImplementationOnce((_input, init) => {
        const signal = init?.signal;
        return new Promise((_resolve, reject) => {
          signal?.addEventListener('abort', () => reject(new Error('unrelated abort message')));
        });
      });

      const promise = expectError(getReleaseStatus(defaultGetParams), ReleaseError, 'Failed to get release status');
      await jest.runAllTimersAsync();

      const err = (await promise) as ReleaseError;
      expect(err.retryable).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('marks a retryable network error without retrying', async () => {
      fetchMock.mockRejectedValue(new Error('fetch failed'));

      const err = (await expectError(
        getReleaseStatus(defaultGetParams),
        ReleaseError,
        'Failed to get release status',
        /failed after 1 attempt[\s\S]*fetch failed/
      )) as ReleaseError;

      expect(err.retryable).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('throws immediately on non-retryable errors without retrying', async () => {
      fetchMock.mockRejectedValue(new Error('noooooooooooooo'));

      const err = (await expectError(
        getReleaseStatus(defaultGetParams),
        ReleaseError,
        'Failed to get release status',
        /noooooooooooooo/
      )) as ReleaseError;

      expect(err.retryable).toBe(false);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('marks failures outside HttpRequestError as non-retryable', async () => {
      jest.spyOn(AbortSignal, 'timeout').mockImplementation(() => {
        throw new Error('unexpected timeout setup failure');
      });

      const err = (await expectError(
        getReleaseStatus(defaultGetParams),
        ReleaseError,
        'Failed to get release status',
        /unexpected timeout setup failure/
      )) as ReleaseError;

      expect(err.retryable).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
