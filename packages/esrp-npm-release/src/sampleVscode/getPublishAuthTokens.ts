// based on https://github.com/microsoft/vscode/blob/main/build/azure-pipelines/common/getPublishAuthTokens.ts
// used by https://github.com/microsoft/vscode/blob/main/build/azure-pipelines/product-publish.yml#L106
// - pwsh: |
//     $publishAuthTokens = (node build/azure-pipelines/common/getPublishAuthTokens.ts)
//     Write-Host "##vso[task.setvariable variable=PUBLISH_AUTH_TOKENS;issecret=true]$publishAuthTokens"
import { getAadToken } from '../utils/getAadToken.ts';
import { getEnv } from '../utils/getEnv.ts';

async function main() {
  const blobServiceAccessToken = await getAadToken({
    endpoint: `https://${getEnv('VSCODE_STAGING_BLOB_STORAGE_ACCOUNT_NAME')}.blob.core.windows.net/`,
    tenantId: getEnv('AZURE_TENANT_ID'),
    clientId: getEnv('AZURE_CLIENT_ID'),
    auth: { idToken: getEnv('AZURE_ID_TOKEN') },
  });
  console.log(JSON.stringify({ blobServiceAccessToken }));
}

if (import.meta.main) {
  main().then(
    () => {
      // eslint-disable-next-line no-restricted-properties
      process.exit(0);
    },
    err => {
      console.error(err);
      // eslint-disable-next-line no-restricted-properties
      process.exit(1);
    }
  );
}
