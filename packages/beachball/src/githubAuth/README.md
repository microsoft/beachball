# create-github-app-token-via-key-vault

Create GitHub App installation tokens by signing the GitHub App JWT with an Azure Key Vault key.

The GitHub App private key is imported into Key Vault and used only through the Key Vault `sign` operation. The key material does not need to be stored in GitHub Actions secrets, Azure Pipelines variables, or checked into a repository.

## Entry points

| Entry point          | Use when                                               | Signing implementation           |
| -------------------- | ------------------------------------------------------ | -------------------------------- |
| CLI (`dist/cli.cjs`) | Running outside GitHub Actions                         | Azure CLI `az keyvault key sign` |
| API (`src/api.ts`)   | Copying the token flow into another TypeScript project | Caller-provided JWT signer       |

## Prerequisites

1. Create a GitHub App and install it on the organization, enterprise, or repositories that should receive tokens.
2. Import the GitHub App private key into Azure Key Vault as a key that supports the `RS256` sign operation. GitHub issues the key as an RSA PEM file, which you can import with the Azure CLI:

   ```bash
   az keyvault key import \
     --vault-name my-vault \
     --name my-github-app-key \
     --pem-file github-app-private-key.pem \
     --ops sign
   ```

   This will output a versioned key. Use the versionless key ID (`https://my-vault.vault.azure.net/keys/my-github-app-key`, with no trailing version) as `KEY_ID` so signing follows key rotation automatically.

3. Grant the workflow identity permission to sign with that Key Vault key. See [`infra/`](infra/) for Bicep templates that grant a user-assigned managed identity signing access (RBAC or access policies).
4. Use the GitHub App client ID (`client-id` / `APP_CLIENT_ID`) as the JWT issuer.

## Standalone CLI

The CLI is a bundled (copy-pastable) Node.js script with no Azure SDK dependency; it signs with the already-authenticated Azure CLI by running `az keyvault key sign`.

Copy `dist/cli.cjs` into the repository or pipeline workspace that needs a token, or download it from this repository before running it.

The CLI requires Node.js 24 or newer and the Azure CLI (`az`) on `PATH`. The Azure CLI must already be authenticated as an identity with permission to sign with the Key Vault key. There are two ways to provide that identity:

- **Local:** run `az login`
- **Azure Pipelines:** run the CLI inside an `AzureCLI@2` task, authenticated from the Azure Resource Manager service connection named in `azureSubscription`.

If `HTTPS_PROXY` or `HTTP_PROXY` is set, also set `NODE_USE_ENV_PROXY=1`.

### Azure Pipelines usage

To use a service connection for signing:

1. Create an [Azure Resource Manager service connection](https://learn.microsoft.com/azure/devops/pipelines/library/connect-to-azure) in your Azure DevOps project.
2. Grant that service connection's identity permission to sign with the Key Vault key — for example the "Key Vault Crypto User" role (RBAC) or a key `sign` permission (access policies) on the vault.
3. Reference the service connection as `azureSubscription` in the `AzureCLI@2` task, and run the CLI as that task's `inlineScript`.

Example Azure Pipelines usage:

```yaml
steps:
  - task: AzureCLI@2
    inputs:
      azureSubscription: Production Azure
      scriptType: bash
      scriptLocation: inlineScript
      inlineScript: node dist/cli.cjs
    env:
      APP_CLIENT_ID: $(MY_GITHUB_APP_CLIENT_ID)
      KEY_ID: $(MY_GITHUB_APP_KEY_ID)
      OWNER: octo-org
      REPOSITORIES: |
        example-repo
        another-repo
      PERMISSIONS: contents:read,issues:write
      OUTPUT: azure-pipelines
      AZURE_TOKEN_VARIABLE: GITHUB_PAT

  # some script that uses the token
  - script: node scripts/use-token.js
    env:
      GITHUB_PAT: $(GITHUB_PAT)
```

### Shell usage

For shell usage, use `OUTPUT=stdout`:

```bash
GH_TOKEN="$(
  APP_CLIENT_ID="$MY_GITHUB_APP_CLIENT_ID" \
  KEY_ID="$MY_GITHUB_APP_KEY_ID" \
  OWNER=octo-org \
  REPOSITORIES=example-repo \
  PERMISSIONS=contents:read \
  OUTPUT=stdout \
  node dist/cli.cjs
)"
```

### CLI environment variables

| Variable               | Required                                                                            | Description                                                                                                                                    |
| ---------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `APP_CLIENT_ID`        | Yes                                                                                 | GitHub App client ID.                                                                                                                          |
| `KEY_ID`               | Yes                                                                                 | Full Azure Key Vault key ID, for example `https://my-vault.vault.azure.net/keys/my-github-app-key/0123456789abcdef0123456789abcdef`.           |
| `OWNER`                | Required unless `ENTERPRISE` is set or `REPOSITORIES` contains `owner/repo` entries | Installation owner. If set without `REPOSITORIES`, creates a token for every repository available to that owner installation.                  |
| `REPOSITORIES`         | No                                                                                  | Comma- or newline-separated repositories. Entries may be `repo` or `owner/repo`.                                                               |
| `ENTERPRISE`           | No                                                                                  | Enterprise slug. Mutually exclusive with `OWNER` and `REPOSITORIES`.                                                                           |
| `PERMISSIONS`          | No                                                                                  | Comma- or newline-separated `permission:level` entries, such as `contents:read,pull_requests:write`. Omit to inherit installation permissions. |
| `OUTPUT`               | No                                                                                  | `azure`, `azure-pipelines`, or `stdout`. Defaults to `stdout`.                                                                                 |
| `AZURE_TOKEN_VARIABLE` | Required for `OUTPUT=azure` or `OUTPUT=azure-pipelines`                             | Azure Pipelines variable name used for the secret token output.                                                                                |
| `GITHUB_API_URL`       | No                                                                                  | GitHub REST API URL. Defaults to `https://api.github.com`.                                                                                     |
| `REVOKE_TOKEN`         | No                                                                                  | If set, revokes the given token and exits. No other variables are required.                                                                    |

To create a token for every repository available to the installation owner, set `OWNER` and omit `REPOSITORIES`. To target an enterprise installation, set `ENTERPRISE`; it cannot be combined with `OWNER` or `REPOSITORIES`.

`OUTPUT=azure` and `OUTPUT=azure-pipelines` are aliases. Both write only the token as a secret Azure Pipelines variable.

When `REVOKE_TOKEN` is set, the CLI revokes the token by calling `DELETE /installation/token` and exits immediately. This does not require Azure CLI authentication, `APP_CLIENT_ID`, or `KEY_ID` — the token authenticates its own revocation. Use this in a pipeline cleanup step with `condition: always()` to revoke tokens even on failure.

## Reusable API

The reusable token flow is in `src/api.ts`. It has no Azure SDK dependency and only needs a signer that returns the base64url-encoded RSA signature for a JWT signing input. For example, sign with the Azure Key Vault SDK inline:

```ts
import { DefaultAzureCredential } from '@azure/identity';
import { CryptographyClient } from '@azure/keyvault-keys';

import { createGitHubAppAuth } from './api';

const cryptographyClient = new CryptographyClient(process.env.KEY_ID!, new DefaultAzureCredential());

const auth = createGitHubAppAuth({
  appClientId: process.env.APP_CLIENT_ID!,
  signer: async signingInput => {
    const signature = await cryptographyClient.signData('RS256', Buffer.from(signingInput));
    return Buffer.from(signature.result).toString('base64url');
  },
});

const installationToken = await auth.getInstallationToken({
  owner: 'octo-org',
  repositories: ['example-repo'],
  permissions: {
    contents: 'read',
    pull_requests: 'write',
  },
});
```

Use `src/azureCliSigner.ts` when you want the low-dependency Azure CLI signing path, or provide your own signer for another key provider.

## Contributing

This project welcomes contributions and suggestions. Most contributions require you to agree to a
Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us
the rights to use your contribution. For details, visit [Contributor License Agreements](https://cla.opensource.microsoft.com).

When you submit a pull request, a CLA bot will automatically determine whether you need to provide
a CLA and decorate the PR appropriately (for example, status check or comment). Follow the instructions
provided by the bot. You will only need to do this once across all repos using our CLA.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or
contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

## Trademarks

This project may contain trademarks or logos for projects, products, or services. Authorized use of Microsoft
trademarks or logos is subject to and must follow
[Microsoft's Trademark & Brand Guidelines](https://www.microsoft.com/legal/intellectualproperty/trademarks/usage/general).
Use of Microsoft trademarks or logos in modified versions of this project must not cause confusion or imply Microsoft sponsorship.
Any use of third-party trademarks or logos are subject to those third-party's policies.
