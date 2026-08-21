import { RestError } from '@azure/storage-blob';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { MockLogger } from '../__fixtures__/MockLogger.ts';
import { isRetryableAzureError, isTransientHttpStatus, retryReleaseError } from '../utils/errorHelpers.ts';
import { ReleaseError } from '../utils/ReleaseError.ts';

describe('isTransientHttpStatus', () => {
  it.each([408, 429, 500, 503, 599])('returns true for transient status %s', statusCode => {
    expect(isTransientHttpStatus(statusCode)).toBe(true);
  });

  it.each([undefined, 400, 401, 403, 404, 409, 499, 600])('returns false for status %s', statusCode => {
    expect(isTransientHttpStatus(statusCode)).toBe(false);
  });
});

describe('isRetryableAzureError', () => {
  it.each([true, false])('preserves ReleaseError retryable=%s', retryable => {
    expect(isRetryableAzureError(new ReleaseError('token failure', { retryable }))).toBe(retryable);
  });

  it.each([RestError.REQUEST_SEND_ERROR, RestError.PARSE_ERROR])('retries pipeline error %s', code => {
    expect(isRetryableAzureError(new RestError('pipeline failure', { code }))).toBe(true);
  });

  it.each([408, 429, 500, 503, 599])('retries HTTP status %s', statusCode => {
    expect(isRetryableAzureError(new RestError('transient response', { statusCode }))).toBe(true);
  });

  it.each([400, 401, 403, 404, 409, 499])('does not retry HTTP status %s', statusCode => {
    expect(isRetryableAzureError(new RestError('permanent response', { statusCode }))).toBe(false);
  });

  it('does not retry an unknown RestError', () => {
    expect(isRetryableAzureError(new RestError('unknown failure'))).toBe(false);
  });

  it('does not retry errors outside the Azure SDK', () => {
    expect(isRetryableAzureError(new Error('unexpected failure'))).toBe(false);
  });
});

describe('retryReleaseError', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('retries retryable errors with exponential backoff and returns the successful result', async () => {
    jest.useFakeTimers();
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const logger = new MockLogger();
    const operation = jest
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new ReleaseError('first failure', { retryable: true }))
      .mockRejectedValueOnce(new ReleaseError('second failure', { retryable: true }))
      .mockResolvedValueOnce('success');

    const result = retryReleaseError(logger, attempt => `Test operation ${attempt}`, operation);
    await jest.advanceTimersByTimeAsync(499);
    expect(operation).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    expect(operation).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(999);
    expect(operation).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(1);

    await expect(result).resolves.toBe('success');
    expect(operation).toHaveBeenCalledTimes(3);
    expect(logger.lines).toEqual([
      expect.stringContaining('Test operation attempt 1 of 4 failed; retrying in 500ms:'),
      expect.stringContaining('Test operation attempt 2 of 4 failed; retrying in 1000ms:'),
    ]);
  });

  it.each([
    ['a non-retryable ReleaseError', new ReleaseError('permanent failure', { retryable: false })],
    ['an unknown error', new Error('unexpected failure')],
  ])('does not retry %s', async (_description, error) => {
    const logger = new MockLogger();
    const operation = jest.fn<() => Promise<void>>().mockRejectedValue(error);

    await expect(retryReleaseError(logger, attempt => `Test operation ${attempt}`, operation)).rejects.toBe(error);
    expect(operation).toHaveBeenCalledTimes(1);
    expect(logger.lines).toEqual([]);
  });

  it('rethrows the last error after four attempts', async () => {
    jest.useFakeTimers();
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const logger = new MockLogger();
    const error = new ReleaseError('temporary failure', { retryable: true });
    const operation = jest.fn<() => Promise<void>>().mockRejectedValue(error);

    const result = retryReleaseError(logger, attempt => `Test operation ${attempt}`, operation);
    result.catch(() => undefined);
    await jest.runAllTimersAsync();

    await expect(result).rejects.toBe(error);
    expect(operation).toHaveBeenCalledTimes(4);
    expect(logger.lines).toHaveLength(3);
    expect(logger.lines[2]).toContain('Test operation attempt 3 of 4 failed; retrying in 2000ms:');
  });
});
