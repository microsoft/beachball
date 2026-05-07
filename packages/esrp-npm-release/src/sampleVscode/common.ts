export interface Artifact {
  name: string;
  resource: {
    downloadUrl: string;
    properties: {
      artifactsize: number;
    };
  };
}

export const env = {
  BUILDS_API_URL: 'azure devops builds API URL',
  /** blob service client access token */
  PUBLISH_AUTH_TOKENS: '{}', // stringified AccessToken
  /** CDN to check if released artifact already exists */
  PRSS_CDN_URL: 'url',
  RELEASE_TENANT_ID: 'str',
  RELEASE_CLIENT_ID: 'str',
  RELEASE_AUTH_CERT: '',
  RELEASE_REQUEST_SIGNING_CERT: '',
  VSCODE_BUILD_STAGE_WINDOWS: 'True|False',
  VSCODE_BUILD_STAGE_LINUX: 'True|False',
  VSCODE_BUILD_STAGE_ALPINE: 'True|False',
  VSCODE_BUILD_STAGE_MACOS: 'True|False',
  VSCODE_BUILD_STAGE_WEB: 'True|False',
  VSCODE_QUALITY: 'str',
  VSCODE_STAGING_BLOB_STORAGE_ACCOUNT_NAME: 'blob storage account name',

  // automatic ADO variables
  AGENT_TEMPDIRECTORY: 'local path',
  BUILD_SOURCEVERSION: 'str',
  PIPELINE_WORKSPACE: 'local path',
  SYSTEM_STAGEATTEMPT: '1',
  SYSTEM_ACCESSTOKEN: 'token',
};
