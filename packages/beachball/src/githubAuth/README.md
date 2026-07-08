# create-github-app-token

Create GitHub App installation tokens by signing the GitHub App JWT with an Azure Key Vault key. Based on https://github.com/microsoft/create-github-app-token-via-key-vault.

The GitHub App private key is imported into Key Vault and used only through the Key Vault `sign` operation. The key material does not need to be stored in GitHub Actions secrets, Azure Pipelines variables, or checked into a repository.

The CLI is available by running the bundled `beachball/dist/create-github-app-token.mjs`, or copying it into a location in your repo.

## Prerequisites

1. Create a GitHub App and install it on the repository that should receive tokens.
2. Navigate to the app settings page:
   - **Org-owned app:** GitHub → your org → Settings → Developer settings → GitHub Apps → your app → Edit.
   - **User-owned app:** GitHub → your profile Settings → Developer settings → GitHub Apps → your app.
3. On the app settings page:
   - Generate a private key for the app (the file will be saved locally).
   - Copy the app's **Client ID** value to use as `APP_CLIENT_ID` later. Note that the client ID is not a secret, and is distinct from the numeric "App ID" shown on the same page.
4. [Set up Azure resources](#azure-resource-setup) (see below):
   - Import the GitHub App private key into Azure Key Vault as a key that supports the `RS256` sign operation. Use the versionless key ID (`https://my-vault.vault.azure.net/keys/my-github-app-key`, with no trailing version) as `KEY_ID` so signing follows key rotation automatically.
   - If using Azure Pipelines, create a managed identity (or use one associated with an existing service connection) and give it permission to sign with that Key Vault key.

## Standalone CLI

The CLI is a bundled (copy-pastable) Node.js script with no Azure SDK dependency; it signs with the already-authenticated Azure CLI by running `az keyvault key sign`.

Copy `dist/create-github-app-token.mjs` into the repository or pipeline workspace that needs a token, or download it from this repository before running it.

The CLI requires Node.js 24 or newer and the Azure CLI (`az`) on `PATH`. The Azure CLI must already be authenticated as an identity with permission to sign with the Key Vault key. There are two ways to provide that identity:

- **Local:** run `az login`
- **Azure Pipelines:** run the CLI inside an `AzureCLI@2` task, authenticated from the Azure Resource Manager service connection named in `azureSubscription`.

If `HTTPS_PROXY` or `HTTP_PROXY` is set, also set `NODE_USE_ENV_PROXY=1`.

### Azure Pipelines usage

1. Create an [Azure Resource Manager service connection](https://learn.microsoft.com/azure/devops/pipelines/library/connect-to-azure) in your Azure DevOps project.
2. [Grant that service connection's identity permission](#azure-resource-setup) to sign with the Key Vault key — for example the "Key Vault Crypto User" role (RBAC) or a key `sign` permission (access policies) on the vault.
3. Reference the service connection as `azureSubscription` in the `AzureCLI@2` task, and run the CLI as that task's `inlineScript`.

Example Azure Pipelines usage:

```yaml
steps:
  - task: AzureCLI@2
    inputs:
      azureSubscription: Production Azure
      scriptType: bash
      scriptLocation: inlineScript
      inlineScript: node dist/create-github-app-token.mjs
    env:
      APP_CLIENT_ID: $(MY_GITHUB_APP_CLIENT_ID)
      KEY_ID: $(MY_GITHUB_APP_KEY_ID)
      REPOSITORY: octo-org/example-repo
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
  REPOSITORY=octo-org/example-repo \
  PERMISSIONS=contents:read \
  OUTPUT=stdout \
  node dist/create-github-app-token.mjs
)"
```

### CLI environment variables

<!-- prettier-ignore -->
| Variable | Required | Description |
| -------- | -------- | ----------- |
| `APP_CLIENT_ID` | Yes | GitHub App client ID (not a secret). See [Prerequisites](#prerequisites) for where to find it in the UI. |
| `KEY_ID` | Yes | Full Azure Key Vault key ID, for example `https://my-vault.vault.azure.net/keys/my-github-app-key/0123456789abcdef0123456789abcdef`. |
| `REPOSITORY` | Yes | Repository to scope the token to, in `owner/repo` format. Used to discover the installation and scope the token. |
| `PERMISSIONS` | No | Comma- or newline-separated `permission:level` entries, such as `contents:read,pull_requests:write`. Omit to inherit installation permissions. |
| `OUTPUT` | No | `azure`, `azure-pipelines`, or `stdout`. Defaults to `stdout`. |
| `AZURE_TOKEN_VARIABLE` | Required for `OUTPUT=azure` or `OUTPUT=azure-pipelines` | Azure Pipelines variable name used for the secret token output. |
| `GITHUB_API_URL` | No | GitHub REST API URL. Defaults to `https://api.github.com`. |
| `REVOKE_TOKEN` | No | If set, revokes the given token and exits. No other variables are required. |

`OUTPUT=azure` and `OUTPUT=azure-pipelines` are aliases. Both write only the token as a secret Azure Pipelines variable.

When `REVOKE_TOKEN` is set, the CLI revokes the token by calling `DELETE /installation/token` and exits immediately. This does not require Azure CLI authentication, `APP_CLIENT_ID`, or `KEY_ID` — the token authenticates its own revocation. Use this in a pipeline cleanup step with `condition: always()` to revoke tokens even on failure.

## Azure resource setup

The following instructions outline how to import the key and grant an identity permissions to use it.

> ⚠️ If you get "conditional access token protection policy" errors with any commands below, try running from https://shell.azure.com instead.

The examples share these variables:

```bash
EMAIL=user@microsoft.com
SUBSCRIPTION="Azure subscription name"
RESOURCE_GROUP=my-vault-rg
KEY_VAULT=my-vault
KEY_NAME=my-github-app-key
LOCAL_KEY_FILE=github-app-private-key.pem
MANAGED_IDENTITY=my-pipeline-identity

az account set --subscription "$SUBSCRIPTION"
VAULT_ID=$(az keyvault show --name "$KEY_VAULT" --query id --output tsv)
```

### 1. Grant yourself key vault access (temporary)

Key vault perms don't inherit from the subscription. If you don't already have permission to import keys and set their RBAC perms, temporarily give yourself the **Key Vault Administrator** role:

```bash
az role assignment create \
  --assignee "$EMAIL" \
  --role "Key Vault Administrator" \
  --scope "$VAULT_ID"
```

### 2. Import the key

```bash
az keyvault key import \
  --vault-name "$KEY_VAULT" \
  --name "$KEY_NAME" \
  --pem-file "$LOCAL_KEY_FILE" \
  --ops sign
```

Use the versionless key ID (`https://$KEY_VAULT.vault.azure.net/keys/$KEY_NAME`, with no trailing version) as `KEY_ID` for the token creation tool so signing follows key rotation automatically.

### 3. Grant the signing identity access

Grant the managed identity or service principal that runs the CLI permission to sign with the key.

For a vault using **RBAC**, assign **Key Vault Crypto User**, scoped to the single key for least privilege:

```bash
MI_PRINCIPAL_ID=$(az identity show \
  --name "$MANAGED_IDENTITY" \
  --resource-group "$RESOURCE_GROUP" \
  --query principalId --output tsv)

az role assignment create \
  --assignee-object-id "$MI_PRINCIPAL_ID" \
  --assignee-principal-type ServicePrincipal \
  --role "Key Vault Crypto User" \
  --scope "$VAULT_ID/keys/$KEY_NAME"
```

(For a vault using legacy access policies, you can manually grant `sign` permission to the managed identity for the entire vault.)

### 4. Revoke your key-import access

Remove the temporary roles once the import is done so you don't retain standing access:

```bash
az role assignment delete \
  --assignee "$EMAIL" \
  --role "Key Vault Administrator" \
  --scope "$VAULT_ID"
```
