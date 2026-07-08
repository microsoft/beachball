import { describe, expect, it } from '@jest/globals';
import { createMockPool } from './authTestHelpers';
import { revokeAppToken } from '../../githubAuth/revokeAppToken';

describe('revokeAppToken', () => {
  it('revokeAppToken calls DELETE /installation/token', async () => {
    const { mockAgent, mockPool } = createMockPool();

    mockPool.intercept({ path: '/installation/token', method: 'DELETE' }).reply(204);

    await revokeAppToken({ token: 'ghs_some_token' });

    const calls = mockAgent.getCallHistory()?.calls() || [];
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('DELETE');
    expect(calls[0].path).toBe('/installation/token');
  });

  it('throws on failed revocation', async () => {
    const { mockPool } = createMockPool();

    mockPool.intercept({ path: '/installation/token', method: 'DELETE' }).reply(401, 'Unauthorized');

    await expect(revokeAppToken({ token: 'ghs_bad_token' })).rejects.toThrow(/Could not revoke/);
  });
});
