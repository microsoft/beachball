import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
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
  });

  describe('error handling', () => {
    it('throws immediately on non-transient HTTP status, including status and body in message', async () => {
      fetchMock.mockResolvedValue(makeFetchResponse({ status: 403, body: 'auth error' }));

      const err = await getReleaseStatus(defaultGetParams).catch(e => e as unknown);
      expect(err).toBeInstanceOf(ReleaseError);
      expect((err as ReleaseError).message).toBe('Failed to get release status');
      expect(((err as ReleaseError).cause as Error).message).toMatch(/failed with status 403[\s\S]*auth error/);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('retries on transient HTTP status and eventually succeeds', async () => {
      jest.useFakeTimers();
      fetchMock
        .mockResolvedValueOnce(makeFetchResponse({ status: 503, body: 'unavailable' }))
        .mockResolvedValueOnce(makeFetchResponse({ status: 429, body: 'slow down' }))
        .mockResolvedValueOnce(makeFetchResponse({ body: '{"status":"pass"}' }));

      const promise = getReleaseStatus(defaultGetParams);
      await jest.runAllTimersAsync();

      await expect(promise).resolves.toEqual({ status: 'pass' });
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('throws after exhausting retries on transient HTTP status', async () => {
      jest.useFakeTimers();
      fetchMock.mockResolvedValue(makeFetchResponse({ status: 500, body: 'internal server error' }));

      const promise = getReleaseStatus(defaultGetParams).catch(e => e as unknown);
      await jest.runAllTimersAsync();

      const err = await promise;
      expect(err).toBeInstanceOf(ReleaseError);
      expect((err as ReleaseError).message).toBe('Failed to get release status');
      expect(((err as ReleaseError).cause as Error).message).toMatch(
        /failed after 10 attempts[\s\S]*status 500[\s\S]*internal server error/
      );
      expect(fetchMock).toHaveBeenCalledTimes(10);
    });

    it('throws when response body is not valid JSON', async () => {
      fetchMock.mockResolvedValue(makeFetchResponse({ body: 'not json' }));

      const err = await getReleaseStatus(defaultGetParams).catch(e => e as unknown);
      expect(err).toBeInstanceOf(ReleaseError);
      expect((err as ReleaseError).message).toBe('Failed to get release status');
      expect(((err as ReleaseError).cause as Error).message).toMatch(/did not return valid JSON[\s\S]*not json/);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('retries on retryable network errors and eventually succeeds', async () => {
      jest.useFakeTimers();
      fetchMock
        .mockRejectedValueOnce(new Error('fetch failed'))
        .mockRejectedValueOnce(new Error('socket hang up'))
        .mockResolvedValueOnce(makeFetchResponse({ body: '{"status":"pass"}' }));

      const promise = getReleaseStatus(defaultGetParams);
      await jest.runAllTimersAsync();

      await expect(promise).resolves.toEqual({ status: 'pass' });
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('throws after exhausting retries', async () => {
      jest.useFakeTimers();
      fetchMock.mockRejectedValue(new Error('fetch failed'));

      const promise = getReleaseStatus(defaultGetParams).catch(e => e as unknown);
      await jest.runAllTimersAsync();

      const err = await promise;
      expect(err).toBeInstanceOf(ReleaseError);
      expect((err as ReleaseError).message).toBe('Failed to get release status');
      expect(((err as ReleaseError).cause as Error).message).toMatch(/failed after 10 attempts[\s\S]*fetch failed/);
      expect(fetchMock).toHaveBeenCalledTimes(10);
    });

    it('throws immediately on non-retryable errors without retrying', async () => {
      fetchMock.mockRejectedValue(new Error('noooooooooooooo'));

      const err = await getReleaseStatus(defaultGetParams).catch(e => e as unknown);
      expect(err).toBeInstanceOf(ReleaseError);
      expect((err as ReleaseError).message).toBe('Failed to get release status');
      expect(((err as ReleaseError).cause as Error).message).toMatch(/noooooooooooooo/);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});
