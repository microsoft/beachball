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
