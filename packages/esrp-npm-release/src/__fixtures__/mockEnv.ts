import type { EnvOptions } from '../getEnvOptions.ts';

/** A complete `EnvOptions` for tests, with sensible defaults. Override fields per-test. */
export function createMockEnv(overrides: Partial<EnvOptions> = {}): EnvOptions {
  return {
    packedPackagesPath: '/tmp/packed',
    packagingFeedId: 'mock-feed-id',
    esrp: {
      productName: 'TestProduct',
      npmTag: undefined,
      createdBy: 'created@example.com',
      driEmail: ['dri@example.com'],
      owners: ['owner@example.com'],
      approvers: ['approver@example.com'],
      tenantId: 'esrp-tenant',
      clientId: 'esrp-client',
      authCertificatePfx: 'mock-auth-pfx',
      requestSigningCertificatePfx: 'mock-signing-pfx',
      ...overrides.esrp,
    },
    staging: {
      storageAccountName: 'stagingaccount',
      clientId: 'staging-client',
      idToken: 'staging-id-token',
      tenantId: 'staging-tenant',
      ...overrides.staging,
    },
    ado: {
      agentTempDirectory: '/tmp/agent',
      buildSourceVersion: 'abcdef0123456789',
      buildRepositoryName: 'org/repo',
      systemCollectionUri: 'https://dev.azure.com/mockorg/',
      systemAccessToken: 'mock-system-access-token',
      ...overrides.ado,
    },
    ...overrides,
  };
}

/** Returns a fully-populated `process.env`-shaped object satisfying `getEnvOptions`. */
export function createMockProcessEnv(overrides: Partial<NodeJS.ProcessEnv> = {}): NodeJS.ProcessEnv {
  return {
    PACKED_PACKAGES_PATH: '/tmp/packed',
    ESRP_PRODUCT_NAME: 'TestProduct',
    ESRP_USER: 'test@example.com',
    ESRP_TENANT_ID: 'esrp-tenant',
    ESRP_CLIENT_ID: 'esrp-client',
    ESRP_AUTH_CERT: 'mock-auth-pfx',
    ESRP_REQUEST_SIGNING_CERT: 'mock-signing-pfx',
    STAGING_STORAGE_ACCOUNT_NAME: 'stagingaccount',
    STAGING_CLIENT_ID: 'staging-client',
    STAGING_ID_TOKEN: 'staging-id-token',
    STAGING_TENANT_ID: 'staging-tenant',
    AGENT_TEMPDIRECTORY: '/tmp/agent',
    BUILD_SOURCEVERSION: 'abcdef0123456789',
    BUILD_REPOSITORY_NAME: 'org/repo',
    SYSTEM_COLLECTIONURI: 'https://dev.azure.com/mockorg/',
    SYSTEM_ACCESSTOKEN: 'mock-system-access-token',
    PACKAGING_FEED_ID: 'mock-feed-id',
    ...overrides,
  };
}
