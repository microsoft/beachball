import { jest } from '@jest/globals';
import type { ReleaseResultMessage } from '../types/api.ts';
import type * as releaseHttp from '../esrpApi/releaseHttp.ts';

/**
 * Programmable fakes for the `releaseHttp` module functions. Use with
 * `jest.unstable_mockModule('../esrpApi/releaseHttp.ts', () => createMockEsrpHttp())`.
 *
 * Default behavior:
 * - `submitRelease` resolves with `{ operationId: 'mock-op-id' }`
 * - `getReleaseStatus` resolves with `{ status: 'pass' }` (override for polling tests)
 * - `getReleaseDetails` resolves with `{}`
 */
export type MockEsrpHttp = jest.Mocked<typeof releaseHttp> & {
  /**
   * Helper for `getReleaseStatus`: queue a sequence of statuses to be returned in order.
   * After the queue is exhausted, the last status is returned indefinitely.
   */
  queueStatuses: (statuses: string[]) => void;
};

export function createMockEsrpHttp(): MockEsrpHttp {
  const getReleaseStatus = jest.fn(() => Promise.resolve({ status: 'pass' } as ReleaseResultMessage));
  return {
    esrpApiEndpoint: 'https://api.esrp.microsoft.com/',
    submitRelease: jest.fn(() => Promise.resolve({ operationId: 'mock-op-id' })),
    getReleaseStatus,
    getReleaseDetails: jest.fn(() => Promise.resolve({})),
    queueStatuses: statuses => {
      let i = 0;
      // eslint-disable-next-line @typescript-eslint/require-await
      getReleaseStatus.mockImplementation(async () => {
        const status = statuses[Math.min(i, statuses.length - 1)];
        i++;
        return { status } as ReleaseResultMessage;
      });
    },
  };
}
