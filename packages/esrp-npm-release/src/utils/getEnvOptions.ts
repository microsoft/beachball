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

  const legacyUsers = getEnv('ESRP_USER', { isOptional: true });
  const ownerEmails = getEnv('ESRP_OWNERS', { defaultValue: legacyUsers });
  const owners = splitString(ownerEmails);
  const defaultCreatedBy = owners[0];
  const driEmail = splitString(getEnv('ESRP_DRI_EMAIL', { isOptional: true }) ?? '');

  const result: EnvOptions = {
    packedPackagesPath: getEnv('PACKED_PACKAGES_PATH'),
    esrp: {
      productName: getEnv('ESRP_PRODUCT_NAME'),
      // skip if unspecified so ESRP will read publishConfig
      npmTag: getEnv('ESRP_NPM_TAG', { isOptional: true }),
      createdBy: getEnv('ESRP_CREATED_BY', { defaultValue: defaultCreatedBy }),
      driEmail: driEmail.length ? driEmail : undefined,
      owners,
      approvers: splitString(getEnv('ESRP_APPROVERS')),
      tenantId: getEnv('ESRP_TENANT_ID'),
      clientId: getEnv('ESRP_CLIENT_ID'),
      authCertificatePfx: getEnv('ESRP_AUTH_CERT', { isOptional: true }),
      idToken: getEnv('ESRP_ID_TOKEN', { isOptional: true }),
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

  const validationErrors: string[] = [];
  if (missingEnv.length) {
    validationErrors.push(`Missing required environment variables: ${missingEnv.join(', ')}`);
  }

  if (!!result.esrp.authCertificatePfx === !!result.esrp.idToken) {
    validationErrors.push(
      result.esrp.authCertificatePfx
        ? 'Only one of ESRP_AUTH_CERT (certificate auth) or ESRP_ID_TOKEN (managed identity auth) may be set.'
        : 'One of ESRP_AUTH_CERT (certificate auth) or ESRP_ID_TOKEN (managed identity auth) must be set.'
    );
  }

  if (validationErrors.length) {
    throw new ReleaseError(validationErrors.join('\n\n'), { retryable: false });
  }
  return result;
}

function splitString(value: string): string[] {
  return value
    .split(/[\s,;]+/)
    .map(s => s.trim())
    .filter(Boolean);
}
