---
tags:
  - ci
category: doc
---

# Auth helper

The `beachball` package provides a `beachball-auth-helper` CLI with authentication-related utilities for CI workflows.

## Prerequisites

- Node 22.18 or later
- `beachball` npm package
- For Azure Key Vault signing (`create-github-app-token` `--key-id` option), the `az` Azure CLI must be available and already authenticated

## CLI commands

The available commands are:

- [`create-github-app-token`](#create-github-app-token): create a GitHub App installation token.
- [`revoke-github-app-token`](#revoke-github-app-token): revoke a previously created GitHub App installation token.
- [`update-lock-registry`](#update-lock-registry): update npm or yarn v1 lock file URLs for a private registry.

### `create-github-app-token`

Create a repository-scoped GitHub App installation token which can be used to authenticate API requests or git operations. The CLI signs a JWT using the app's private key (stored in Azure Key Vault or a secret), discovers the repository app installation, and creates a token. See the [GitHub App setup steps](#github-app-setup) and [usage examples](#usage-create-github-app-token) for more details.

The generated token is valid for one hour, but it's best to immediately call [`revoke-github-app-token`](#revoke-github-app-token) when finished.

This CLI takes inspiration from [`microsoft/create-github-app-token-via-key-vault`](https://github.com/microsoft/create-github-app-token-via-key-vault) and [`actions/create-github-app-token`](https://github.com/actions/create-github-app-token). Either of those might be easier to use if running via GitHub Actions.

#### Options

Exactly one **signing source** is required: either `--key-id` (Azure key vault key ID) or `PRIVATE_KEY` (PEM-encoded GitHub App private key), as configured in the [GitHub App setup steps](#github-app-setup). If using `--key-id`, the `az` CLI must be on `PATH` and authenticated first.

By default, the token is written to stdout. Use `--ci-output-name` in CI to save it as a task/step output.

Besides `PRIVATE_KEY`, none of the other inputs need to be handled as secrets.

<!-- prettier-ignore -->
| Input | Required | Description |
| ----- | -------- | ----------- |
| `--app-client-id` | Yes | GitHub App client ID. See [GitHub App setup steps](#github-app-setup) for where to find it in the UI. |
| `--key-id` | One signing source | Azure Key Vault key ID, e.g. `https://my-vault.vault.azure.net/keys/my-github-app-key` - see [Azure resource setup](#azure-resource-setup). The `az` CLI must be on `PATH` and authenticated to use this option. |
| `PRIVATE_KEY` (env var) | One signing source | PEM-encoded GitHub App private key. Escaped newlines (`\\n`) in the private key are converted to actual newlines. |
| `--repository` | Yes | Repository for the app installation and token scope, in `owner/repo` format. |
| `--permissions` | | Comma-separated `permission:level` entries, such as `contents:read, pull_requests:write` (see [valid `permissions` properties and values](https://docs.github.com/en/rest/apps/apps?apiVersion=2026-03-10#create-an-installation-access-token-for-an-app)). Omit to inherit the installation perms. Requested perms cannot exceed those granted to the app installation. Spaces are ignored. |
| `--ci-output-name` | | Instead of writing the token to stdout, save it as an Azure Pipelines secret step output or masked GitHub Actions step output. Must be a valid environment variable name. |
| `--github-api-url` | | GitHub REST API URL (customizable for GitHub Enterprise). Defaults to `https://api.github.com`. |

### `revoke-github-app-token`

The `revoke-github-app-token` command revokes a token by calling `DELETE /installation/token`. The token authenticates its own revocation. Run this command in an always-running cleanup step (as shown in the [usage examples](#usage-create-github-app-token)) so the token is revoked even if an earlier step fails.

<!-- prettier-ignore -->
| Input | Description |
| ----- | ----------- |
| `TOKEN` (env var) | Installation token to revoke. |
| `--github-api-url` | (optional) GitHub REST API URL (customizable for GitHub Enterprise). Defaults to `https://api.github.com`. |

### `update-lock-registry`

For npm or yarn v1, update public registry URLs in the repo's lock file to point to a private registry. This command is a no-op for other package managers, yarn v2 and later, or the default public registry. It errors if the lock file does not contain the expected registry URL.

<!-- prettier-ignore -->
| Input | Description |
| ----- | ----------- |
| `--registry` | Private npm registry URL. |
| `--revert` | (optional) Restore lock file URLs to the default public registry. |

```bash
yarn beachball-auth-helper update-lock-registry --registry "https://registry.example.com/"
```

## Usage: `create-github-app-token`

:::tip
This section assumes you've followed the [GitHub App setup steps](#github-app-setup), as well as the [Azure setup steps](#azure-resource-setup) if using `--key-id`.
:::

If `HTTPS_PROXY` or `HTTP_PROXY` is set, also set `NODE_USE_ENV_PROXY=1` so Node uses the configured proxy.

### Shell

Assuming you're logged into Azure with `az login` (or previously ran an Azure login task in CI):

```bash
# create
GH_TOKEN="$(
  yarn beachball-auth-helper create-github-app-token \
    --app-client-id "<app client ID>" \
    --key-id "<key vault key URL>" \
    --repository "<your repo>" \
    --permissions "<perms>"
)"

# revoke
TOKEN="$GH_TOKEN" yarn beachball-auth-helper revoke-github-app-token
```

To sign directly with the app private key instead of Azure Key Vault:

```bash
GH_TOKEN="$(
  PRIVATE_KEY="$APP_PRIVATE_KEY" yarn beachball-auth-helper create-github-app-token \
    --app-client-id "<app client ID>" \
    --repository "<your repo>" \
    --permissions "<perms>"
)"
```

### GitHub Actions

You can either store the app private key as a GitHub Actions secret (as shown below), or use an Azure Key Vault and the [`azure/login` action](https://github.com/Azure/login).

Give the token creation step an `id`; the name passed to `--ci-output-name` becomes an output of that step.

```yaml
steps:
  # If you want to read the token from a key vault, use the `azure/login` action first
  # and pass --key-id instead.
  - name: Create GitHub App token
    id: app-token
    run: |
      yarn beachball-auth-helper create-github-app-token \
        --repository "${{ github.repository }}" \
        --app-client-id "<app client id>" \
        --permissions "<perms>" \
        --ci-output-name MY_TOKEN
    env:
      PRIVATE_KEY: ${{ secrets.MY_GITHUB_APP_PRIVATE_KEY }}

  - name: Use token
    run: node scripts/use-token.js
    env:
      GITHUB_TOKEN: ${{ steps.app-token.outputs.MY_TOKEN }}

  - name: Revoke GitHub App token
    if: ${{ always() && steps.app-token.outputs.MY_TOKEN != '' }}
    run: yarn beachball-auth-helper revoke-github-app-token
    env:
      TOKEN: ${{ steps.app-token.outputs.MY_TOKEN }}
```

### Azure Pipelines

Similarly to GitHub actions, you can use either secrets or Azure Key Vault to provide the key. This example uses Azure Key Vault and assumes the [resource setup steps](#azure-resource-setup) below.

Give the token creation task a `name`; the name passed to `--ci-output-name` becomes an output of that task.

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
      inlineScript: |
        yarn beachball-auth-helper create-github-app-token \
          --app-client-id "<app client id>" \
          --key-id "<key vault key URL>" \
          --repository "$(Build.Repository.Name)" \
          --permissions "<perms>" \
          --ci-output-name MY_TOKEN

  # some script that uses the token
  - script: node scripts/use-token.js
    env:
      GITHUB_TOKEN: $(createToken.MY_TOKEN)

  - script: yarn beachball-auth-helper revoke-github-app-token
    displayName: Revoke GitHub App token
    condition: and(always(), ne(variables['createToken.MY_TOKEN'], ''))
    env:
      TOKEN: $(createToken.MY_TOKEN)
```

## GitHub App setup

The `create-github-app-token` command uses a GitHub App as an **identity with permissions** (similar to an Azure managed identity or service principal); the app doesn't need any logic. Set up an app in your repository as follows:

1. [Create a GitHub App](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/registering-a-github-app) with the relevant permissions (no logic or endpoints needed), and install it in the repository that should receive tokens.
2. Navigate to the app settings page:
   - **Org-owned app:** GitHub → your org → Settings → Developer settings → GitHub Apps → your app → Edit.
   - **User-owned app:** GitHub → your profile Settings → Developer settings → GitHub Apps → your app.
3. On the app settings page:
   - Generate a private key for the app (the file is automatically downloaded).
   - Copy the app's **Client ID** value to use as `--app-client-id` later. This typically starts with `Iv1` or `Iv2` and is distinct from the numeric "App ID" shown on the same page. It does _not_ need to be treated as a secret.
4. Choose where to store the app's private key:
   - **Azure Key Vault** + `--key-id` (more secure): the private key is stored in the key vault and only used via `az keyvault key sign`. The key ID is passed to the CLI as `--key-id`. [Full instructions below](#azure-resource-setup).
   - **CI secret** + `PRIVATE_KEY`: Store the PEM-encoded private key as a CI secret, and pass it to the CLI as `PRIVATE_KEY`. In GitHub Actions, you should [use an environment](../ci-integration#storing-secrets) to restrict access.

## Azure resource setup

Follow these instructions if you'd like to store the GitHub App private key used for `create-github-app-token` in an Azure key vault. The steps below outline how to create a service connection, import the key, and grant an identity permissions to use it.

:::tip
If you get "conditional access token protection policy" errors with any commands below, try running from [Azure cloud shell](https://shell.azure.com) instead.
:::

The preferred process uses an Azure Resource Manager service connection with a **user-assigned managed identity** for simpler ongoing management (a connection with an app registration will also work).

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

Create the identity that Azure Pipelines will use to sign with the Key Vault key (you might need to run this from [Azure cloud shell](https://shell.azure.com)):

```bash
az identity create \
  --name "$MANAGED_IDENTITY" \
  --resource-group "$RESOURCE_GROUP"
```

The resource group must already exist. The managed identity can be in a different resource group from the Key Vault, but update `RESOURCE_GROUP` accordingly when running identity commands.

### 2. Connect to Azure

For GitHub workflows, configure the [`azure/login` action](https://github.com/Azure/login).

For Azure Pipelines, follow the steps below, or skip if you already have a service connection.

In your Azure DevOps project, [create an Azure Resource Manager service connection](https://learn.microsoft.com/en-us/azure/devops/pipelines/library/connect-to-azure?view=azure-devops#create-a-service-connection-for-an-existing-user-assigned-managed-identity) with the managed identity. Select the subscription, resource group, and managed identity created in the previous step.

Use the service connection's name as `azureSubscription` in the `AzureCLI@2` task as shown in the [Azure example](#azure-pipelines) above.

(Alternatively, you could create a connection of type "App registration with workload identity federation (automatic)", but it's more awkward to handle ongoing maintenance of app registration owners.)

### 3. Grant yourself key vault access (temporary)

Key vault perms don't inherit from the subscription. If you don't already have permission to import keys and set their RBAC perms, temporarily give yourself the **Key Vault Administrator** role (you might need to run this from [Azure cloud shell](https://shell.azure.com)):

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

Use the versionless key ID (`https://$KEY_VAULT.vault.azure.net/keys/$KEY_NAME`, with no trailing version) as `--key-id` for the token creation tool so signing follows key rotation automatically.

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
