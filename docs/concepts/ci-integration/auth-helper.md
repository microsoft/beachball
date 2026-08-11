---
tags:
  - ci
category: doc
---

# Auth helper

The `beachball` package provides a `beachball-auth-helper` CLI which can create GitHub App installation tokens by signing a JWT with the app's private key, which is stored in either Azure Key Vault or a CI secret. With Azure Key Vault, the private key is imported and used only through the `az keyvault key sign` operation.

This CLI takes inspiration from [`microsoft/create-github-app-token-via-key-vault`](https://github.com/microsoft/create-github-app-token-via-key-vault) and [`actions/create-github-app-token`](https://github.com/actions/create-github-app-token). Either of those might be easier to use if running via GitHub Actions.

## Prerequisites

### Dependencies

- Node 22+
- `beachball` npm package
- For Azure Key Vault signing (`KEY_ID` option), the `az` Azure CLI must be available and already authenticated

### Setup steps

1. Create a GitHub App and install it on the repository that should receive tokens.
2. Navigate to the app settings page:
   - **Org-owned app:** GitHub → your org → Settings → Developer settings → GitHub Apps → your app → Edit.
   - **User-owned app:** GitHub → your profile Settings → Developer settings → GitHub Apps → your app.
3. On the app settings page:
   - Generate a private key for the app (the file will be saved locally).
   - Copy the app's **Client ID** value to use as `APP_CLIENT_ID` later. Note that the client ID is not a secret, and is distinct from the numeric "App ID" shown on the same page.
4. Choose where to store the private key:
   - Azure key vault (more secure):
     - Import the GitHub App private key into Azure Key Vault as a key that supports the `RS256` sign operation. Use the versionless key ID (`https://my-vault.vault.azure.net/keys/my-github-app-key`, with no trailing version) as `KEY_ID` so signing follows key rotation automatically.
     - If using Azure Pipelines, create a managed identity (or use one associated with an existing service connection) and give it permission to sign with that Key Vault key. See [Azure resource setup](#azure-resource-setup) for instructions.
   - Store the PEM-encoded private key as a CI secret, and provide it as `PRIVATE_KEY`.

## CLI commands

The CLI has two commands:

- `create-gha-token` mints an installation token
- `revoke-gha-token` revokes a previously minted token

Every option can be passed as a command-line flag or through the matching environment variable (a flag takes precedence over its environment variable).

### `create-gha-token`

The `create-gha-token` command creates a GitHub App installation token with the given options, and outputs it either to stdout (default) or to an Azure Pipelines secret variable.

When using `KEY_ID`, the Azure CLI (`az`) must be on `PATH` and already authenticated as an identity with permission to sign with the Key Vault key. There are two ways to provide that identity:

- **Local:** run `az login`
- **Azure Pipelines:** run the CLI inside an `AzureCLI@2` task, authenticated from the Azure Resource Manager service connection named in `azureSubscription`.

If `HTTPS_PROXY` or `HTTP_PROXY` is set, also set `NODE_USE_ENV_PROXY=1`.

All values can also be specified as environment variables, e.g. `APP_CLIENT_ID` for `--app-client-id`. `PRIVATE_KEY` is a secret and should be supplied through a secret environment variable rather than a command-line argument. Escaped newlines (`\\n`) in the private key are converted to actual newlines.

<!-- prettier-ignore -->
| Flag | Description |
| ---- | ----------- |
| `--app-client-id` | GitHub App client ID. See [Prerequisites](#prerequisites) for where to find it in the UI. |
| `--key-id` | Azure Key Vault key ID. Mutually exclusive with `--private-key`. |
| `--private-key` | Prefer providing with `PRIVATE_KEY` environment variable: PEM-encoded GitHub App private key. Mutually exclusive with `--key-id`. |
| `--repository` | Repository to scope the token to, in `owner/repo` format. Used to discover the installation and scope the token. |
| `--permissions` | (optional) Comma-separated list of `permission:level` entries (see [valid `permissions` properties](https://docs.github.com/en/rest/apps/apps?apiVersion=2026-03-10#create-an-installation-access-token-for-an-app)), such as `contents: read,pull_requests: write`. Omit to inherit installation permissions. |
| `--output-name` | (optional) Save the token without writing it to stdout. In Azure Pipelines, this creates a **secret variable**. In GitHub Actions, this creates a masked **step output** with the given name through `GITHUB_OUTPUT`. |
| `--github-api-url` | (optional) GitHub REST API URL. Defaults to `https://api.github.com`. |

### `revoke-gha-token`

Run the `revoke-gha-token` command to revoke a token by calling `DELETE /installation/token` and exit immediately. The token authenticates its own revocation. Use it in a pipeline cleanup step with `condition: always()` to revoke tokens even on failure.

<!-- prettier-ignore -->
| Flag | Variable | Description |
| ---- | -------- | ----------- |
| `--token` | `TOKEN` | Installation token to revoke. Recommended to specify as an environment variable. |
| `--github-api-url` | `GITHUB_API_URL` | (optional) GitHub REST API URL. Defaults to `https://api.github.com`. |

## Usage

### Shell

Assuming you're logged into Azure locally with `az login`:

```bash
# create
GH_TOKEN="$(
  yarn beachball-auth-helper create-gha \
    --app-client-id "$APP_CLIENT_ID" \
    --key-id "$KEY_ID" \
    --repository "octo-org/example-repo" \
    --permissions "contents:write"
)"

# revoke
TOKEN="$GH_TOKEN" yarn beachball-auth-helper revoke-gha
```

To sign directly with the app private key instead of Azure Key Vault:

```bash
GH_TOKEN="$(
  PRIVATE_KEY="$APP_PRIVATE_KEY" yarn beachball-auth-helper create-gha \
    --app-client-id "$APP_CLIENT_ID" \
    --repository "octo-org/example-repo" \
    --permissions "contents:write"
)"
```

### Azure Pipelines

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
      # can use any mix of options and env
      inlineScript: |
        yarn beachball-auth-helper create-gha \
          --repository "octo-org/example-repo" \
          --permissions "contents:read,issues:write" \
          --output-name MY_TOKEN
    env:
      APP_CLIENT_ID: $(MY_GITHUB_APP_CLIENT_ID)
      KEY_ID: $(MY_GITHUB_APP_KEY_ID)

  # some script that uses the token
  - script: node scripts/use-token.js
    env:
      GITHUB_TOKEN: $(MY_TOKEN)

  # TODO add revoke step that always runs as cleanup
```

### GitHub Actions

<!-- TODO -->

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
