import { ReleaseError } from './utils/ReleaseError.ts';

export interface EnvOptions {
  /** Path to the directory of packed .tgz files organized into numbered layer subdirectories */
  packedPackagesPath: string;

  esrp: EsrpEnvOptions;
  /** Info for temporarily uploading packages to a storage account in your team's subscription */
  staging: StagingEnvOptions;
  /**
   * Predefined ADO pipeline variables (set automatically by the agent).
   * https://learn.microsoft.com/en-us/azure/devops/pipelines/build/variables?view=azure-devops&tabs=yaml
   */
  ado: AdoEnvOptions;
}

export interface EsrpEnvOptions {
  /** Release product name */
  productName: string;
  /**
   * Optional npm dist-tag for the published packages. When unspecified, ESRP will read
   * `publishConfig` from each package.
   */
  npmTag: string | undefined;
  /** Email of the user creating the release */
  createdBy: string;
  /** Email of the DRI for the team creating the release */
  driEmail: string[];
  /** Owner emails */
  owners: string[];
  /** Approver emails (all non-mandatory and auto-approved) */
  approvers: string[];

  /** Production tenant ID used for your ESRP app registration */
  tenantId: string;
  /** Client ID used for your ESRP app registration in a production tenant */
  clientId: string;

  /** Base64-encoded PFX certificate used for authenticating to ESRP AAD */
  authCertificatePfx: string;
  /** Base64-encoded PFX certificate used for signing JWS tokens in release requests */
  requestSigningCertificatePfx: string;
}

export interface StagingEnvOptions {
  /** Storage account name for staging the packages */
  storageAccountName: string;
  /** Client ID used for storage account access */
  clientId: string;
  /** ID token used for storage account access */
  idToken: string;
  /** Tenant ID used for storage account access */
  tenantId: string;
}

/**
 * ADO built-in variables used by this package.
 * https://learn.microsoft.com/en-us/azure/devops/pipelines/build/variables
 */
export interface AdoEnvOptions {
  /** ADO `Agent.TempDirectory` */
  agentTempDirectory: string;
  /** Git commit of the source */
  buildSourceVersion: string;
  /** Repository name (for GitHub-connected repos this is "org/repo"; bare name for ADO Repos) */
  buildRepositoryName: string;
}

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
