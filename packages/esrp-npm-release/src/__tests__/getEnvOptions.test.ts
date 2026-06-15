import { describe, expect, it } from '@jest/globals';
import { createMockProcessEnv } from '../__fixtures__/mockEnv.ts';
import { getEnvOptions } from '../utils/getEnvOptions.ts';
import { ReleaseError } from '../utils/ReleaseError.ts';

describe('getEnvOptions', () => {
  it('returns a fully-populated EnvOptions object when all required vars are set', () => {
    const env = getEnvOptions(createMockProcessEnv());

    expect(env).toEqual({
      packedPackagesPath: '/tmp/packed',
      esrp: {
        productName: 'TestProduct',
        npmTag: undefined,
        createdBy: 'test@example.com',
        driEmail: ['test@example.com'],
        owners: ['test@example.com'],
        approvers: ['test@example.com'],
        tenantId: 'esrp-tenant',
        clientId: 'esrp-client',
        authCertificatePfx: 'mock-auth-pfx',
        requestSigningCertificatePfx: 'mock-signing-pfx',
      },
      staging: {
        storageAccountName: 'stagingaccount',
        clientId: 'staging-client',
        idToken: 'staging-id-token',
        tenantId: 'staging-tenant',
      },
      ado: {
        agentTempDirectory: '/tmp/agent',
        buildSourceVersion: 'abcdef0123456789',
        buildRepositoryName: 'org/repo',
      },
    });
  });

  it('uses ESRP_USER as fallback for createdBy/driEmail/owners/approvers when those are unset', () => {
    const env = getEnvOptions(
      createMockProcessEnv({
        ESRP_USER: 'fallback@example.com',
        ESRP_CREATED_BY: undefined,
        ESRP_DRI_EMAIL: undefined,
        ESRP_OWNERS: undefined,
        ESRP_APPROVERS: undefined,
      })
    );

    expect(env.esrp.createdBy).toBe('fallback@example.com');
    expect(env.esrp.driEmail).toEqual(['fallback@example.com']);
    expect(env.esrp.owners).toEqual(['fallback@example.com']);
    expect(env.esrp.approvers).toEqual(['fallback@example.com']);
  });

  it('prefers explicit values over ESRP_USER fallback', () => {
    const env = getEnvOptions(
      createMockProcessEnv({
        ESRP_USER: 'fallback@example.com',
        ESRP_CREATED_BY: 'creator@example.com',
        ESRP_OWNERS: 'a@example.com,b@example.com',
        ESRP_APPROVERS: 'c@example.com,d@example.com',
      })
    );

    expect(env.esrp.createdBy).toBe('creator@example.com');
    expect(env.esrp.owners).toEqual(['a@example.com', 'b@example.com']);
    expect(env.esrp.approvers).toEqual(['c@example.com', 'd@example.com']);
  });

  it('treats ESRP_NPM_TAG="" as undefined', () => {
    const env = getEnvOptions(createMockProcessEnv({ ESRP_NPM_TAG: '' }));
    expect(env.esrp.npmTag).toBeUndefined();
  });

  it('passes ESRP_NPM_TAG through when set', () => {
    const env = getEnvOptions(createMockProcessEnv({ ESRP_NPM_TAG: 'beta' }));
    expect(env.esrp.npmTag).toBe('beta');
  });

  it('throws ReleaseError listing all missing required env vars', () => {
    const baseEnv = createMockProcessEnv();
    delete baseEnv.PACKED_PACKAGES_PATH;
    delete baseEnv.ESRP_PRODUCT_NAME;
    delete baseEnv.STAGING_TENANT_ID;

    let err: unknown;
    try {
      getEnvOptions(baseEnv);
    } catch (e) {
      err = e;
    }

    expect(err).toBeInstanceOf(ReleaseError);
    expect((err as ReleaseError).message).toContain('PACKED_PACKAGES_PATH');
    expect((err as ReleaseError).message).toContain('ESRP_PRODUCT_NAME');
    expect((err as ReleaseError).message).toContain('STAGING_TENANT_ID');
  });

  it('requires no ESRP_USER when individual user fields are all set', () => {
    const env = createMockProcessEnv({
      ESRP_USER: undefined,
      ESRP_CREATED_BY: 'a@example.com',
      ESRP_DRI_EMAIL: 'b@example.com',
      ESRP_OWNERS: 'c@example.com',
      ESRP_APPROVERS: 'd@example.com',
    });
    expect(() => getEnvOptions(env)).not.toThrow();
  });

  it('throws when ESRP_USER and individual user fields are all unset', () => {
    const env = createMockProcessEnv({
      ESRP_USER: undefined,
      ESRP_CREATED_BY: undefined,
      ESRP_DRI_EMAIL: undefined,
      ESRP_OWNERS: undefined,
      ESRP_APPROVERS: undefined,
    });

    let err: unknown;
    try {
      getEnvOptions(env);
    } catch (e) {
      err = e;
    }

    expect(err).toBeInstanceOf(ReleaseError);
    expect((err as ReleaseError).message).toContain('ESRP_CREATED_BY, ESRP_DRI_EMAIL, ESRP_OWNERS, ESRP_APPROVERS');
  });
});
