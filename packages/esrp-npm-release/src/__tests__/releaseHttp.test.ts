import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { getReleaseDetails, getReleaseStatus, submitRelease } from '../utils/releaseHttp.ts';
import type { ReleaseRequestMessage } from '../models/types.ts';

const baseUrl = 'https://api.esrp.microsoft.com/api/v3/releaseservices/clients/';

const mockRequest = { driEmail: ['example@example.com'] } as ReleaseRequestMessage;

function makeFetchResponse(opts: { status?: number; ok?: boolean; body: string }): Response {
  const status = opts.status ?? 200;
  const ok = opts.ok ?? (status >= 200 && status < 300);
  return {
    ok,
    status,
    text: () => Promise.resolve(opts.body),
  } as Response;
}

describe('releaseHttp', () => {
  let fetchMock: jest.Mock<typeof fetch>;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    fetchMock = jest.fn<typeof fetch>();
    globalThis.fetch = fetchMock;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('submitRelease', () => {
    it('POSTs to operations endpoint with content-type, JSON body, and parses response', async () => {
      fetchMock.mockResolvedValue(makeFetchResponse({ body: '{"operationId":"op-1"}' }));

      const result = await submitRelease({ clientId: 'cid', bearerToken: 'tok', releaseRequest: mockRequest });

      expect(result).toEqual({ operationId: 'op-1' });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}cid/workflows/release/operations`, {
        method: 'POST',
        headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
        body: JSON.stringify(mockRequest),
      });
    });
  });

  describe('getReleaseStatus', () => {
    it('GETs the grs endpoint and parses response', async () => {
      fetchMock.mockResolvedValue(makeFetchResponse({ body: '{"status":"pass"}' }));

      const result = await getReleaseStatus({ clientId: 'cid', bearerToken: 'tok', releaseId: 'rid' });

      expect(result).toEqual({ status: 'pass' });
      expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}cid/workflows/release/operations/grs/rid`, {
        method: 'GET',
        headers: { Authorization: 'Bearer tok' },
      });
    });
  });

  describe('getReleaseDetails', () => {
    it('GETs the grd endpoint and parses response', async () => {
      fetchMock.mockResolvedValue(makeFetchResponse({ body: '{"foo":"bar"}' }));

      const result = await getReleaseDetails({ clientId: 'cid', bearerToken: 'tok', releaseId: 'rid' });

      expect(result).toEqual({ foo: 'bar' });
      expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}cid/workflows/release/operations/grd/rid`, {
        method: 'GET',
        headers: { Authorization: 'Bearer tok' },
      });
    });
  });

  describe('error handling', () => {
    it('throws when response is not ok, including status and body in message', async () => {
      fetchMock.mockResolvedValue(makeFetchResponse({ status: 500, body: 'internal server error' }));

      await expect(getReleaseStatus({ clientId: 'c', bearerToken: 't', releaseId: 'r' })).rejects.toThrow(
        /failed with status 500[\s\S]*internal server error/
      );
    });

    it('throws when response body is not valid JSON', async () => {
      fetchMock.mockResolvedValue(makeFetchResponse({ body: 'not json' }));

      await expect(getReleaseStatus({ clientId: 'c', bearerToken: 't', releaseId: 'r' })).rejects.toThrow(
        /did not return valid JSON[\s\S]*not json/
      );
    });

    it('retries on retryable network errors and eventually succeeds', async () => {
      jest.useFakeTimers();
      try {
        fetchMock
          .mockRejectedValueOnce(new Error('fetch failed'))
          .mockRejectedValueOnce(new Error('socket hang up'))
          .mockResolvedValueOnce(makeFetchResponse({ body: '{"status":"pass"}' }));

        const promise = getReleaseStatus({ clientId: 'c', bearerToken: 't', releaseId: 'r' });
        await jest.runAllTimersAsync();

        await expect(promise).resolves.toEqual({ status: 'pass' });
        expect(fetchMock).toHaveBeenCalledTimes(3);
      } finally {
        jest.useRealTimers();
      }
    });

    it('throws after exhausting retries', async () => {
      jest.useFakeTimers();
      try {
        fetchMock.mockRejectedValue(new Error('fetch failed'));

        const promise = getReleaseStatus({ clientId: 'c', bearerToken: 't', releaseId: 'r' });
        // Suppress unhandled rejection warning while we run timers
        promise.catch(() => undefined);

        await jest.runAllTimersAsync();

        await expect(promise).rejects.toThrow(/failed after 10 attempts.*fetch failed/);
        expect(fetchMock).toHaveBeenCalledTimes(10);
      } finally {
        jest.useRealTimers();
      }
    });

    it('throws immediately on non-retryable errors without retrying', async () => {
      fetchMock.mockRejectedValue(new Error('noooooooooooooo'));

      await expect(getReleaseStatus({ clientId: 'c', bearerToken: 't', releaseId: 'r' })).rejects.toThrow(
        /Request to .* failed.*noooooooooooooo/
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});
