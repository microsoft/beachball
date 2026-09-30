import { describe, expect, it } from '@jest/globals';
import { expectErrorSync } from '@microsoft/beachball-test-utilities';
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
        driEmail: undefined,
        owners: ['test@example.com'],
        approvers: ['approver@example.com'],
        tenantId: 'esrp-tenant',
        clientId: 'esrp-client',
        authCertificatePfx: 'mock-auth-pfx',
        idToken: undefined,
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

  it.each([
    ['spaces', ' '],
    ['tabs', '\t'],
    ['newlines', '\n'],
    ['commas', ','],
    ['semicolons', ';'],
    ['mixed separators', ' \t,\n; '],
  ])('splits ESRP_OWNERS on %s', (_name, separator) => {
    const env = getEnvOptions(
      createMockProcessEnv({
        ESRP_OWNERS: `first@example.com${separator}second@example.com`,
        ESRP_CREATED_BY: undefined,
        ESRP_DRI_EMAIL: undefined,
      })
    );

    expect(env.esrp.createdBy).toBe('first@example.com');
    expect(env.esrp.driEmail).toBeUndefined();
    expect(env.esrp.owners).toEqual(['first@example.com', 'second@example.com']);
    expect(env.esrp.approvers).toEqual(['approver@example.com']);
  });

  it('accepts ESRP_USER as a fallback alias', () => {
    const env = getEnvOptions(
      createMockProcessEnv({
        ESRP_USER: 'legacy@example.com',
        ESRP_CREATED_BY: undefined,
        ESRP_DRI_EMAIL: undefined,
        ESRP_OWNERS: undefined,
      })
    );

    expect(env.esrp.createdBy).toBe('legacy@example.com');
    expect(env.esrp.driEmail).toBeUndefined();
    expect(env.esrp.owners).toEqual(['legacy@example.com']);
    expect(env.esrp.approvers).toEqual(['approver@example.com']);
  });

  it('prefers ESRP_OWNERS over ESRP_USER', () => {
    const env = getEnvOptions(
      createMockProcessEnv({
        ESRP_OWNERS: 'preferred@example.com',
        ESRP_USER: 'legacy@example.com',
        ESRP_CREATED_BY: undefined,
        ESRP_DRI_EMAIL: undefined,
      })
    );

    expect(env.esrp.createdBy).toBe('preferred@example.com');
    expect(env.esrp.driEmail).toBeUndefined();
    expect(env.esrp.owners).toEqual(['preferred@example.com']);
    expect(env.esrp.approvers).toEqual(['approver@example.com']);
  });

  it('prefers explicit values over ESRP_OWNERS defaults', () => {
    const env = getEnvOptions(
      createMockProcessEnv({
        ESRP_CREATED_BY: 'creator@example.com',
        ESRP_DRI_EMAIL: 'dri-a@example.com\ndri-b@example.com',
        ESRP_OWNERS: 'a@example.com,b@example.com',
        ESRP_APPROVERS: 'c@example.com\nd@example.com',
      })
    );

    expect(env.esrp.createdBy).toBe('creator@example.com');
    expect(env.esrp.driEmail).toEqual(['dri-a@example.com', 'dri-b@example.com']);
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

    expectErrorSync(() => getEnvOptions(baseEnv), ReleaseError, [
      'PACKED_PACKAGES_PATH',
      'ESRP_PRODUCT_NAME',
      'STAGING_TENANT_ID',
    ]);
  });

  it('throws when ESRP_OWNERS and ESRP_USER are both unset', () => {
    const env = createMockProcessEnv({
      ESRP_USER: undefined,
      ESRP_CREATED_BY: undefined,
      ESRP_DRI_EMAIL: undefined,
      ESRP_OWNERS: undefined,
      ESRP_APPROVERS: undefined,
    });

    expectErrorSync(() => getEnvOptions(env), ReleaseError, 'ESRP_OWNERS, ESRP_CREATED_BY, ESRP_APPROVERS');
  });

  describe('ESRP authentication', () => {
    it('uses certificate auth by default', () => {
      const env = getEnvOptions(createMockProcessEnv());
      expect(env.esrp.authCertificatePfx).toBe('mock-auth-pfx');
      expect(env.esrp.idToken).toBeUndefined();
    });

    it('uses managed identity auth when ESRP_ID_TOKEN is set instead of ESRP_AUTH_CERT', () => {
      const env = getEnvOptions(
        createMockProcessEnv({ ESRP_AUTH_CERT: undefined, ESRP_ID_TOKEN: 'federated-id-token' })
      );
      expect(env.esrp).toEqual({
        ...env.esrp,
        authCertificatePfx: undefined,
        idToken: 'federated-id-token',
      });
    });

    it('throws when neither auth method is configured', () => {
      const env = createMockProcessEnv({ ESRP_AUTH_CERT: undefined, ESRP_ID_TOKEN: undefined });
      expect(() => getEnvOptions(env)).toThrow(
        'One of ESRP_AUTH_CERT (certificate auth) or ESRP_ID_TOKEN (managed identity auth) must be set'
      );
    });

    it('throws when both auth methods are configured', () => {
      const env = createMockProcessEnv({ ESRP_AUTH_CERT: 'cert', ESRP_ID_TOKEN: 'token' });
      expect(() => getEnvOptions(env)).toThrow(
        'Only one of ESRP_AUTH_CERT (certificate auth) or ESRP_ID_TOKEN (managed identity auth) may be set'
      );
    });
  });
});
