---
tags:
  - ci
category: doc
---

# Auth helper

The `beachball` package provides a `beachball-auth-helper` CLI which creates repository-scoped GitHub App installation tokens. The CLI signs a JWT using the app's private key (stored in Azure Key Vault or a secret), discovers the app installation for the requested repository, and creates a token scoped to that repository.

Installation tokens expire after one hour. Create a token immediately before use and revoke it in an always-running cleanup step when finished.

This CLI takes inspiration from [`microsoft/create-github-app-token-via-key-vault`](https://github.com/microsoft/create-github-app-token-via-key-vault) and [`actions/create-github-app-token`](https://github.com/actions/create-github-app-token). Either of those might be easier to use if running via GitHub Actions.

## Prerequisites

### Dependencies

- Node 22.18 or later
- `beachball` npm package
- For Azure Key Vault signing (`KEY_ID` option), the `az` Azure CLI must be available and already authenticated

### Setup steps

1. Create a GitHub App and install it on the repository that should receive tokens.
2. Navigate to the app settings page:
   - **Org-owned app:** GitHub → your org → Settings → Developer settings → GitHub Apps → your app → Edit.
   - **User-owned app:** GitHub → your profile Settings → Developer settings → GitHub Apps → your app.
3. On the app settings page:
   - Generate a private key for the app (the file is automatically downloaded).
   - Copy the app's **Client ID** value to use as `--app-client-id` later. This is a 23-character typically starting with `Iv1` or `Iv2`. It's _not_ a secret, and is distinct from the numeric "App ID" shown on the same page.
4. Choose where to store the app's private key:
   - **Azure Key Vault** + `--key-id` (more secure): the private key is stored in the key vault, passed to the CLI as `--key-id`, and is only used via `az keyvault key sign`. [Full instructions below](#azure-resource-setup).
   - **CI secret** + `PRIVATE_KEY`: Store the PEM-encoded private key as a CI secret, and pass it to the CLI as `PRIVATE_KEY`. In GitHub Actions, you should [use an environment](../ci-integration#storing-secrets) to restrict access.

## CLI commands

The CLI has two commands:

- `create-gha-token` creates an installation token.
- `revoke-gha-token` revokes a previously created token.

Every option can be passed as a command-line flag or through the matching environment variable (a flag takes precedence over its environment variable).

### `create-gha-token`

The `create-gha-token` command requires the app client ID, repository, and exactly one **signing source**:

- **Azure Key Vault key ID** (`--key-id`/`KEY_ID`): In this case, the Azure CLI (`az`) must be on `PATH` and already authenticated as an identity with permission to sign with the Key Vault key. There are two ways to provide that identity:
  - Local: run `az login`
  - GitHub Actions: run the `azure/login` action first
  - Azure Pipelines: run the CLI inside an `AzureCLI@2` task, authenticated from the Azure Resource Manager service connection named in `azureSubscription`.
- **PEM-encoded private key** (`PRIVATE_KEY`): This should be supplied through a secret environment variable rather than a command-line argument.

By default, the token is written to stdout. Use `--output-name` in CI to save it as a secret/output.

Besides `PRIVATE_KEY`, none of the other inputs need to be handled as secrets.

<!-- prettier-ignore -->
| Flag | Variable | Required | Description |
| ---- | -------- | -------- | ----------- |
| `--app-client-id` | `APP_CLIENT_ID` | Yes | GitHub App client ID. See [Setup steps](#setup-steps) for where to find it in the UI. |
| `--key-id` | `KEY_ID` | One signing source | Azure Key Vault key ID, e.g. `https://my-vault.vault.azure.net/keys/my-github-app-key`. Mutually exclusive with `PRIVATE_KEY`. |
| `--private-key` | `PRIVATE_KEY` | One signing source | PEM-encoded GitHub App private key (should be provided as `PRIVATE_KEY` env var). Escaped newlines (`\\n`) in the private key are converted to actual newlines. Mutually exclusive with `--key-id`. |
| `--repository` | `REPOSITORY` | Yes | Repository for the app installation and token scope, in `owner/repo` format. |
| `--permissions` | `PERMISSIONS` |  | Comma-separated `permission:level` entries, such as `contents:read, pull_requests:write` (see [valid `permissions` properties](https://docs.github.com/en/rest/apps/apps?apiVersion=2026-03-10#create-an-installation-access-token-for-an-app) and values). Omit to inherit the installation perms. Requested perms cannot exceed those granted to the app installation. Spaces are ignored. |
| `--output-name` | `OUTPUT_NAME` |  | Instead of writing the token to stdout, save it as an Azure Pipelines secret step output or masked GitHub Actions step output. Must be a valid environment variable name, and only works in CI environments. |
| `--github-api-url` | `GITHUB_API_URL` |  | GitHub REST API URL (customizable for GitHub Enterprise). Defaults to `https://api.github.com`. |

### `revoke-gha-token`

The `revoke-gha-token` command revokes a token by calling `DELETE /installation/token`. The token authenticates its own revocation. Run this command in an always-running cleanup step so the token is revoked even if an earlier step fails.

<!-- prettier-ignore -->
| Flag | Variable | Description |
| ---- | -------- | ----------- |
| `--token` | `TOKEN` | Installation token to revoke. Recommended to specify as an environment variable. |
| `--github-api-url` | `GITHUB_API_URL` | (optional) GitHub REST API URL (customizable for GitHub Enterprise). Defaults to `https://api.github.com`. |

## Usage

If `HTTPS_PROXY` or `HTTP_PROXY` is set, also set `NODE_USE_ENV_PROXY=1` so Node uses the configured proxy.

### Shell

Assuming you're logged into Azure with `az login` (or previously ran an Azure login task in CI):

```bash
# create
GH_TOKEN="$(
  yarn beachball-auth-helper create-gha-token \
    --app-client-id "<app client ID>" \
    --key-id "<key vault key URL>" \
    --repository "<your repo>" \
    --permissions "<perms>"
)"

# revoke
TOKEN="$GH_TOKEN" yarn beachball-auth-helper revoke-gha-token
```

To sign directly with the app private key instead of Azure Key Vault:

```bash
GH_TOKEN="$(
  PRIVATE_KEY="$APP_PRIVATE_KEY" yarn beachball-auth-helper create-gha-token \
    --app-client-id "<app client ID>" \
    --repository "<your repo>" \
    --permissions "<perms>"
)"
```

### GitHub Actions

You can either store the app private key as a GitHub Actions secret (as shown below), or use an Azure Key Vault and the [`azure/login` action](https://github.com/Azure/login).

Give the token creation step an `id`; the name passed to `--output-name` becomes an output of that step.

```yaml
steps:
  # If you want to read the token from a key vault, use the `azure/login` action first
  # and pass --key-id instead.
  - name: Create GitHub App token
    id: app-token
    run: |
      yarn beachball-auth-helper create-gha-token \
        --repository "${{ github.repository }}" \
        --app-client-id "<app client id>" \
        --permissions "<perms>" \
        --output-name MY_TOKEN
    env:
      PRIVATE_KEY: ${{ secrets.MY_GITHUB_APP_PRIVATE_KEY }}

  - name: Use token
    run: node scripts/use-token.js
    env:
      GITHUB_TOKEN: ${{ steps.app-token.outputs.MY_TOKEN }}

  - name: Revoke GitHub App token
    if: ${{ always() && steps.app-token.outputs.MY_TOKEN != '' }}
    run: yarn beachball-auth-helper revoke-gha-token
    env:
      TOKEN: ${{ steps.app-token.outputs.MY_TOKEN }}
```

### Azure Pipelines

Similarly to GitHub actions, you can use either secrets or Azure Key Vault to provide the key. This example uses Azure Key Vault and assumes the [resource setup steps](#azure-resource-setup) below.

Give the token creation task a `name`; the name passed to `--output-name` becomes an output of that task.

Example Azure Pipelines usage:

```yaml
steps:
  - task: AzureCLI@2
    name: createToken
    displayName: Create GitHub App token
    inputs:
      azureSubscription: <your service connection name>
      scriptType: bash
      scriptLocation: inlineScript
      # can use any mix of options and env
      inlineScript: |
        yarn beachball-auth-helper create-gha-token \
          --app-client-id "<app client id>" \
          --key-id "<key vault key URL>" \
          --repository "$(Build.Repository.Name)" \
          --permissions "<perms>" \
          --output-name MY_TOKEN

  # some script that uses the token
  - script: node scripts/use-token.js
    env:
      GITHUB_TOKEN: $(createToken.MY_TOKEN)

  - script: yarn beachball-auth-helper revoke-gha-token
    displayName: Revoke GitHub App token
    condition: and(always(), ne(variables['createToken.MY_TOKEN'], ''))
    env:
      TOKEN: $(createToken.MY_TOKEN)
```

## Azure resource setup

The following instructions outline how to create a service connection, import the key, and grant an identity permissions to use it.

:::warning
If you get "conditional access token protection policy" errors with any commands below, try running from https://shell.azure.com instead.
:::

The preferred process uses an Azure Resource Manager service connection with a **user-assigned managed identity** for simpler ongoing management (a connection with an app registration will also work). Azure CLI commands are shown for permission and key updates, but you could do the same in the Azure portal UI if desired.

The steps share these variables:

```bash
EMAIL=you@example.com
SUBSCRIPTION="Azure subscription name"
RESOURCE_GROUP=my-vault-rg
KEY_VAULT=my-vault
KEY_NAME=my-github-app-key
LOCAL_KEY_FILE=github-app-private-key.pem
MANAGED_IDENTITY=my-pipeline-identity

az account set --subscription "$SUBSCRIPTION"
VAULT_ID=$(az keyvault show --name "$KEY_VAULT" --query id --output tsv)
```

### 1. Create a user-assigned managed identity

(Skip if you already have an identity and/or service connection, or if you want to use an app registration service connection instead.)

Create the identity that Azure Pipelines will use to sign with the Key Vault key (you might need to run this from https://shell.azure.com):

```bash
az identity create \
  --name "$MANAGED_IDENTITY" \
  --resource-group "$RESOURCE_GROUP"
```

The resource group must already exist. The managed identity can be in a different resource group from the Key Vault, but update `RESOURCE_GROUP` accordingly when running identity commands.

### 2. Create a service connection

(Skip if you already have a service connection.)

In your Azure DevOps project, [create an Azure Resource Manager service connection](https://learn.microsoft.com/en-us/azure/devops/pipelines/library/connect-to-azure?view=azure-devops#create-a-service-connection-for-an-existing-user-assigned-managed-identity) with the managed identity. Select the subscription, resource group, and managed identity created in the previous step. Use the service connection's name as `azureSubscription` in the `AzureCLI@2` task.

(Alternatively, you could create a connection of type "App registration with workload identity federation (automatic)", but it's more awkward to handle ongoing maintenance of app registration owners.)

### 3. Grant yourself key vault access (temporary)

Key vault perms don't inherit from the subscription. If you don't already have permission to import keys and set their RBAC perms, temporarily give yourself the **Key Vault Administrator** role (you might need to run this from https://shell.azure.com):

```bash
az role assignment create \
  --assignee "$EMAIL" \
  --role "Key Vault Administrator" \
  --scope "$VAULT_ID"
```

### 4. Import the key

```bash
az keyvault key import \
  --vault-name "$KEY_VAULT" \
  --name "$KEY_NAME" \
  --pem-file "$LOCAL_KEY_FILE" \
  --ops sign
```

Use the versionless key ID (`https://$KEY_VAULT.vault.azure.net/keys/$KEY_NAME`, with no trailing version) as `--key-id`/`KEY_ID` for the token creation tool so signing follows key rotation automatically.

### 5. Grant the signing identity access

Grant the managed identity used by the service connection permission to sign with the key.

For a vault using **RBAC**, assign **Key Vault Crypto User**, scoped to the single key for least privilege:

```bash
# For user-assigned managed identity:
PRINCIPAL_ID=$(az identity show \
  --name "$MANAGED_IDENTITY" \
  --resource-group "$RESOURCE_GROUP" \
  --query principalId --output tsv)

# For automatic service connection with app registration:
PRINCIPAL_ID=$(az ad sp show \
  --id "<service connection app/client ID>" \
  --query id \
  --output tsv)

# For both:
az role assignment create \
  --assignee-object-id "$PRINCIPAL_ID" \
  --assignee-principal-type ServicePrincipal \
  --role "Key Vault Crypto User" \
  --scope "$VAULT_ID/keys/$KEY_NAME"
```

(For a vault using legacy access policies, you can manually grant `sign` permission to the managed identity for the entire vault.)

### 6. Revoke your key-import access

Remove the temporary roles once the import is done so you don't retain standing access:

```bash
az role assignment delete \
  --assignee "$EMAIL" \
  --role "Key Vault Administrator" \
  --scope "$VAULT_ID"
```
