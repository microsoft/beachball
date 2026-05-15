import type { EnvOptions } from '../types/EnvOptions.ts';
import { ReleaseError } from './ReleaseError.ts';

/**
 * Read environment variables and return a fully-populated `EnvOptions` object.
 * Throws `ReleaseError` listing every missing required variable.
 *
 * Accepts an optional `env` source (defaulting to `process.env`) so this can be unit-tested
 * without mutating real environment variables.
 */
export function getEnvOptions(env: NodeJS.ProcessEnv = process.env): EnvOptions {
  const missingEnv: string[] = [];

  function getEnv(name: string, options?: { defaultValue?: string }): string;
  function getEnv(name: string, options: { isOptional: true }): string | undefined;
  function getEnv(name: string, options?: { defaultValue?: string; isOptional?: boolean }): string | undefined {
    const result = env[name];
    if (result) return result;
    if (options?.defaultValue !== undefined) return options.defaultValue;
    if (options?.isOptional) return undefined;
    // collect all errors and throw at the end
    missingEnv.push(name);
    return '';
  }

  // ESRP_USER serves as a fallback default for the contact email fields below
  const defaultUser = getEnv('ESRP_USER', { isOptional: true });

  const result: EnvOptions = {
    packedPackagesPath: getEnv('PACKED_PACKAGES_PATH'),
    esrp: {
      productName: getEnv('ESRP_PRODUCT_NAME'),
      // skip if unspecified so ESRP will read publishConfig
      npmTag: getEnv('ESRP_NPM_TAG', { isOptional: true }),
      createdBy: getEnv('ESRP_CREATED_BY', { defaultValue: defaultUser }),
      driEmail: [getEnv('ESRP_DRI_EMAIL', { defaultValue: defaultUser })],
      owners: splitString(getEnv('ESRP_OWNERS', { defaultValue: defaultUser })),
      approvers: splitString(getEnv('ESRP_APPROVERS', { defaultValue: defaultUser })),
      tenantId: getEnv('ESRP_TENANT_ID'),
      clientId: getEnv('ESRP_CLIENT_ID'),
      authCertificatePfx: getEnv('ESRP_AUTH_CERT'),
      requestSigningCertificatePfx: getEnv('ESRP_REQUEST_SIGNING_CERT'),
    },
    staging: {
      storageAccountName: getEnv('STAGING_STORAGE_ACCOUNT_NAME'),
      clientId: getEnv('STAGING_CLIENT_ID'),
      idToken: getEnv('STAGING_ID_TOKEN'),
      tenantId: getEnv('STAGING_TENANT_ID'),
    },
    ado: {
      agentTempDirectory: getEnv('AGENT_TEMPDIRECTORY'),
      buildSourceVersion: getEnv('BUILD_SOURCEVERSION'),
      buildRepositoryName: getEnv('BUILD_REPOSITORY_NAME'),
    },
  };

  if (missingEnv.length) {
    throw new ReleaseError(`Missing required environment variables: ${missingEnv.join(', ')}`);
  }
  return result;
}

function splitString(value: string): string[] {
  return value
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}
