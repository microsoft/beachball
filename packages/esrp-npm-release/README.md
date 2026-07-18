# @microsoft/esrp-npm-release

Tool for teams within Microsoft who would like to use ESRP to release npm packages in **dependency-topological order**: always publishing a package's internal dependencies before publishing the package itself. Especially in larger repos with many package consumers, this ordering is critical to ensure that if publishing fails partway through, there are never published packages with dangling references to nonexistent versions (which would cause installation failures in consuming repos).

> **When _not_ to use this tool:** This tool requires extra setup (see below) and isn't owned by the ESRP team. For single packages or smaller monorepos where your team hasn't hit issues with publish ordering, you should use the official `EsrpRelease` task for simplicity. Or if you care about ordering but only have a few packages, it might be possible to manually group them and run the task multiple times.

## Contents

- [Overview](#overview)
- [Packed packages format](#packed-packages-format)
- [Staging resource setup](#staging-resource-setup)
  - [1. Create the resource group](#1-create-the-resource-group)
  - [2. Deploy the Bicep template](#2-deploy-the-bicep-template)
    - [Storage account and lifecycle policy](#storage-account-and-lifecycle-policy)
    - [Managed identity and roles](#managed-identity-and-roles)
  - [3. Create a service connection](#3-create-the-service-connection)
- [Pipeline setup](#pipeline-setup)
  - [Prerequisite: Service connections](#prerequisite-service-connections)
  - [Prerequisite: Internal feed setup](#prerequisite-internal-feed-setup)
  - [Example pipeline YAML](#example-pipeline-yaml)
- [Tool inputs](#tool-inputs)

## Overview

The tool is a bundled CLI (`dist/index.mjs`) that runs during a release job and publishes npm packages through the ESRP release API in the proper order. Since release jobs can't directly download sources or install dependencies, the CLI bundle is meant to be included in a pipeline artifact from the build stage, then consumed and run by the release stage.

The tool itself doesn't calculate dependency order. Instead, it relies on receiving the packages already grouped into [dependency tree layers](#packed-packages-format): numbered subfolders where the packages in each layer depend only on packages in earlier layers. (`beachball publish --pack-to-path` produces this layout, but you could extend other change/release management tools to do the same.) The tool releases the layers in numeric order, so every internal dependency a package references is already published before that package's own layer.

For each layer, the tool:

1. Zips the layer's package tarballs.
2. Temporarily uploads the zip to a "staging" blob storage account, since the ESRP release API only accepts blob storage URLs, not files uploaded as request bodies. (See [compliance notes](#managed-identity-and-roles) below.)
3. Calls the ESRP release API to publish the layer, waiting for it to complete before moving on to the next layer.
4. Deletes the staged zip (cleanup also has an automated fallback, described [below](#storage-account-and-lifecycle-policy)).

The tool relies on the following inputs and resources:

- [**Packed packages**](#packed-packages-format): Output folder from `beachball publish --pack-to-path <path>` or in the same format
- **ESRP Azure resources** configured per their guides (see docs on eng.ms):
  - **ESRP-onboarded app registration** in a production tenant (need client ID and tenant ID)
  - **Production tenant key vault** storing the ESRP auth certificate and request signing certificate (PFX format, base64-encoded)
  - **Production tenant managed identity** with access to the app registration and key vault
  - **ADO Azure Resource Manager service connection** using the managed identity
- [**Staging resources**](#staging-resource-setup) specific to this tool (see below for setup details):
  - **Azure Blob Storage account** in your team's subscription (usually in the corp tenant) to temporarily host zips of packages
  - **Managed identity** with the right RBAC roles on the storage account (used to create user delegation keys for blob access)
  - **ADO Azure Resource Manager service connection** using the managed identity

## Packed packages format

Running `beachball publish --pack-to-path <path>` produces a directory with this shape. If there are 10+ layers, the directories must be zero-padded (e.g. `01`, `02`, ..., `10`, etc.) to ensure correct lexical ordering.

```
<path>/
├── 01/                    # Layer 1: packages with no internal dependencies
│   ├── pkg-a-1.0.0.tgz
│   └── pkg-b-2.0.0.tgz
├── 02/                    # Layer 2: packages that depend only on layer 1
│   └── pkg-c-3.0.0.tgz
├── 03/
│   └── ...
...
```

Each numbered directory is a **dependency-topological layer**: the packages in layer 1 have no internal dependencies, or none within the set of packages being published. Packages in layer `N` may only depend on packages in layers `1..N-1`. The tool releases layers in numeric order, so that by the time a layer is published, every internal dependency version it references is already on the registry.

## Staging resource setup

Follow the steps below to create the Azure resources used by this tool: resource group, storage account, user-assigned managed identity, RBAC assignments, and lifecycle management policy. The Azure subscription can be in either the corp tenant or a production tenant.

The commands below reuse the same subscription, resource group, storage account, and managed identity names, so set them once in your shell to keep the snippets copy-pasteable:

```bash
SUBSCRIPTION="<sub>"
RESOURCE_GROUP="<rg>"
STORAGE_ACCOUNT="<storage>"
MANAGED_IDENTITY="<uami-name>"
```

### 1. Create the resource group

Either use an existing group, or run the command below to create a new one. (To see available locations: `az account list-locations --output tsv --query "[].name"`)

```bash
az group create \
  --subscription "$SUBSCRIPTION" \
  --name "$RESOURCE_GROUP" \
  --location <location>
```

### 2. Deploy the Bicep template

Use the Bicep template at [`.ado/roleAssignments.bicep`](https://github.com/microsoft/beachball/blob/main/.ado/roleAssignments.bicep) to create the storage account, blob lifecycle policy, user-assigned managed identity, and required RBAC assignments (see notes below about how each piece is used).

Preview the changes first. If a storage account with the given name already exists in the resource group, its properties are reconciled to match the template, and this command will show the diff.

```bash
az deployment group what-if \
  --subscription "$SUBSCRIPTION" \
  --resource-group "$RESOURCE_GROUP" \
  --template-file roleAssignments.bicep \
  --parameters \
    stagingStorageName="$STORAGE_ACCOUNT" \
    managedIdentityName="$MANAGED_IDENTITY"
```

Apply changes:

```bash
az deployment group create \
  --subscription "$SUBSCRIPTION" \
  --resource-group "$RESOURCE_GROUP" \
  --template-file roleAssignments.bicep \
  --parameters \
    stagingStorageName="$STORAGE_ACCOUNT" \
    managedIdentityName="$MANAGED_IDENTITY"
```

The deployment is idempotent: re-running it reconciles drift in the storage account properties, role assignments, and lifecycle policy. The storage account name will be passed to the tool as `STAGING_STORAGE_ACCOUNT_NAME`.

#### Storage account and lifecycle policy

Within the storage account, the tool uses two blob storage containers (automatically created) as part of the release process:

- `staging`: Temporarily hosts the zipped layers so ESRP can download them via user delegation SAS URL.
- `release-state`: Persist retry state so ADO stage retries can resume from where a previous attempt left off. State is keyed by repo name, build source version, product name, and npm tag if set.

The template also configures an [Azure Storage lifecycle management policy](https://learn.microsoft.com/azure/storage/blobs/lifecycle-management-overview) on the staging storage account. It cleans up `release-state` blobs automatically after (as of writing) 90 days, and `staging` blobs after 3 days. (The release tool attempts to delete the `staging` blobs immediately after the release, but the policy provides a fallback.)

#### Managed identity and roles

All storage access uses Entra ID auth: the tool authenticates with a managed identity, and ESRP downloads each artifact via a short-lived, read-only [user delegation SAS](https://learn.microsoft.com/azure/storage/blobs/storage-blob-user-delegation-sas-create-cli) URL. Storage account keys and public blob access are disabled, so this setup is compliant with Microsoft's Safe Secrets Standard for storage accounts (SFI-ID4.2.1).

The template assigns two **data-plane** roles to the managed identity at the storage account scope. Control-plane roles like `Contributor` or `Owner` are **not sufficient**; without the roles below, you'd see a 403 error like "This request is not authorized to perform this operation using this permission" the first time the tool tried to list or write a blob.

- **Storage Blob Data Contributor**: List, read, write, and delete blobs in the `staging` and `release-state` containers, and create the containers on first use.
- **Storage Blob Delegator**: Mint short-lived user-delegation SAS tokens that ESRP uses to download staged zips.

RBAC propagation usually takes less than five minutes. If a freshly-assigned role still produces 403s, wait a few minutes and retry.

### 3. Create the service connection

In your ADO project, create an **Azure Resource Manager** service connection:

- **Identity type**: Managed identity (automatically configures Workload Identity Federation)
- **Managed identity details**: Choose your subscription, resource group, and identity
- **Azure scope**: Choose the same subscription and resource group
- **Service Connection Name**: Choose any name and make note of it for later

The release stage (later) passes the connection's name to `AzureCLI@2` as `azureSubscription`. It uses the option `addSpnToEnvironment: true` to obtain a federated `idToken` that this tool exchanges for an AAD access token at runtime, so there are no long-lived secrets to manage.

## Pipeline setup

This tool is designed to run in an Azure DevOps pipeline, presumably using 1ES Pipeline Templates. The typical setup has one stage or pipeline which builds the code and outputs an artifact with the packed packages and release API, and a second stage or pipeline which consumes those artifacts and runs the release tool.

### Prerequisite: Service connections

The pipeline typically uses two Azure Resource Manager service connections:

- **ESRP (production tenant)**: access to key vault with the ESRP auth certificate and request signing certificate (see [overview](#overview) and [ESRP resource inputs](#esrp-resources))
- **Staging**: access to staging blob storage (see [staging service connection](#3-create-the-service-connection) and [staging resource inputs](#staging-resources))

### Prerequisite: Internal feed setup

If your repo normally installs packages from `registry.npmjs.org` or `registry.yarnpkg.com`, you'll need to set up an internal feed for the publish build only (since 1ES PT official templates restrict access to public npm). Steps vary depending on your package manager but are outlined below.

#### All package managers

1. Choose a feed in your project (or create a new one) that has the public npm registry as an upstream source, and note its URL.
1. Create a file `.npmrc.publish` at the repo root with the corresponding `registry` setting: e.g. `registry=https://pkgs.dev.azure.com/office/_packaging/Office/npm/registry/`
1. Add `.npmrc` to `.gitignore`
1. In your pipeline, add an inline script to copy `.npmrc.publish` to `.npmrc` (or merge them if you already have `.npmrc`), then `npmAuthenticate` if necessary:
   ```yml
   - script: cp .npmrc.publish .npmrc

   - task: npmAuthenticate@0
     inputs:
       workingFile: $(Build.SourcesDirectory)/.npmrc
   ```

#### `yarn` berry (v2+)

1. Add and commit the plugin [`yarn-plugin-npmrc`](https://github.com/microsoft/beachball/tree/main/yarn-plugins/npmrc) so that `yarn` will pick up credentials from `.npmrc` (but don't set the `npmrcAuthEnabled` setting).
1. In your pipeline, add a step after the `.npmrc.publish` update to set Yarn config via `YARN_*` variables (which will persist to later steps): registry, force auth, and enable `yarn-plugin-npmrc`.
   ```yml
   - script: |
       registry="$(npm config get registry)"
       echo "##vso[task.setvariable variable=YARN_NPM_REGISTRY_SERVER]$registry"
       echo "##vso[task.setvariable variable=YARN_NPM_ALWAYS_AUTH]true"
       echo "##vso[task.setvariable variable=YARN_NPMRC_AUTH_ENABLED]true"
     displayName: Configure private registry for yarn
   ```

#### `npm` or `yarn` v1

These package managers save resolved URLs in the lock file, which requires an extra step to manually overwrite them before installing.

1. Make a copy of [`scripts/preparePublishRegistry.ts`](https://github.com/microsoft/beachball/blob/main/scripts/preparePublishRegistry.ts) in your repo.
1. In your pipeline, **before** deps are installed, add a step to run the script.
1. If you're using Beachball and a package manager that reflects local package versions in the lock file (and therefore must update and commit the lock file after bumping), you'll also need `hooks.precommit` in `beachball.config.js` to revert the URL changes. See [`scripts/revertPublishRegistryHook.ts`](https://github.com/microsoft/beachball/blob/main/scripts/revertPublishRegistryHook.ts) for a sample hook implementation.

### Example pipeline YAML

The typical release process using this tool has two main parts, which could be either stages or separate pipelines depending on your desired setup:

1. **Build** stage or pipeline: builds the repo, packs the packages, and publishes a single pipeline artifact containing the packed packages and the release tool (since 1ES PT release jobs can't access source code or npm feeds).
2. **Publish/release** stage or pipeline: consumes those artifacts and runs the release tool to publish via ESRP. The job should use 1ES PT template options `type: releaseJob` and `isProduction: true`.

In 1ES PT, the presence of a production release job applies stricter network isolation policies to the _entire_ pipeline. If you're using a single pipeline, you'll need to re-enable the access the rest of the pipeline needs (GitHub, Azure) via the `networkIsolationPolicy` setting.

The example below covers a **single pipeline**. Be sure to **fill in all the `<placeholders>`!** See https://github.com/microsoft/beachball/blob/main/.ado/release.yml for a full example, which also pushes updates to GitHub. (For an example of separate pipelines, see this [build pipeline](https://github.com/microsoft/node-api-dotnet/blob/main/.ado/publish.yml) and [publish/release pipeline](https://github.com/microsoft/node-api-dotnet/blob/main/.ado/release.yml). Ignore the parts targeting non-Node platforms.)

<details><summary><b>Expand for full pipeline example</b></summary>

```yml
# Build number/name - modify as desired
name: <name>-release-$(Date:yyyy-MM-dd).$(Rev:rr)

pr: none
trigger: none

resources:
  repositories:
    # fill in per 1ES PT instructions for your org
    - repository: <template repo>
      type: git
      name: <template repo name>
      ref: <release tag>

variables:
  tags: production
  nodeVersion: 24
  artifactName: release-artifacts
  packagesDirName: packed-packages
  toolDirName: release-api-tool
  # TODO: remove once beachball supports reading npmrc registry
  registry: <private registry (same as .npmrc.publish)>

extends:
  template: <1ES PT template>
  parameters:
    pool:
      name: <pool name>
      vmImage: windows-latest
      os: windows # some scans require windows

    settings:
      # If any job has `type: releaseJob`, it applies strict network isolation to the whole pipeline.
      # Re-enable the access needed.
      networkIsolationPolicy: AzureActiveDirectory,AzureKeyVault,AzureResourceManager,AzureStorage,GitHub

    stages:
      - stage: build
        displayName: Build artifacts
        jobs:
          - job: build
            displayName: Build, test, pack

            pool:
              name: <1ES PT pool name>
              # could also use windows
              image: ubuntu-latest
              os: linux

            workspace:
              clean: all

            variables:
              artifactPath: $(Build.StagingDirectory)/out
              packagesArtifactPath: $(artifactPath)/${{ variables.packagesDirName }}
              toolArtifactPath: $(artifactPath)/${{ variables.toolDirName }}
              # update as needed for your install layout
              toolBinPath: $(Build.SourcesDirectory)/node_modules/@microsoft/esrp-npm-release/dist/index.mjs

            templateContext:
              outputs:
                # single artifact containing all subfolders under artifactPath
                # (this reduces compliance scanning overhead)
                - output: pipelineArtifact
                  artifactName: ${{ variables.artifactName }}
                  path: $(artifactPath)

            steps:
              - checkout: self

              - task: UseNode@1
                displayName: Install Node.js ${{ variables.nodeVersion }}
                inputs:
                  version: ${{ variables.nodeVersion }}.x
                  checkLatest: false

              - script: cp .npmrc.publish .npmrc
                displayName: Use private npm registry

              # ONLY yarn v4: persist yarn config via YARN_* vars
              - script: |
                  registry="$(npm config get registry)"
                  echo "##vso[task.setvariable variable=YARN_NPM_REGISTRY_SERVER]$registry"
                  echo "##vso[task.setvariable variable=YARN_NPM_ALWAYS_AUTH]true"
                  echo "##vso[task.setvariable variable=YARN_NPMRC_AUTH_ENABLED]true"
                displayName: Configure private registry for yarn

              - task: npmAuthenticate@0
                displayName: npm authenticate
                inputs:
                  workingFile: $(Build.SourcesDirectory)/.npmrc

              # ONLY for npm / yarn v1: rewrite lock file URLs to the private registry.
              # (update script path as needed)
              - script: node scripts/preparePublishRegistry.ts
                displayName: (npm or yarn v1) Prepare lock file registry settings

              # This isn't used, it's just a clear way to check that auth is working
              # (yarn install's auth errors can be very unclear)
              - script: yarn npm info beachball
                displayName: Get package to verify registry auth

              # TODO: insert steps to install, build, test, etc

              # Bump and pack packages (update command as needed).
              # This could also run some other script that outputs packages in the same format.
              - script: |
                  mkdir -p '$(packagesArtifactPath)'
                  yarn beachball publish --no-push --pack-to-path '$(packagesArtifactPath)' --registry '$(registry)'
                displayName: Pack packages

              - script: |
                  mkdir -p '$(toolArtifactPath)'
                  cp -r '$(toolBinPath)' '$(toolArtifactPath)'
                displayName: Copy release API tool to staging directory

      - stage: publish
        displayName: Publish
        dependsOn: build
        jobs:
          - job: npm_publish
            displayName: Publish npm packages

            pool:
              name: <1ES PT pool name>
              image: ubuntu-latest
              os: linux

            variables:
              artifactPath: $(Agent.BuildDirectory)/${{ variables.artifactName }}
              packagesArtifactPath: $(artifactPath)/${{ variables.packagesDirName }}
              toolArtifactBin: $(artifactPath)/${{ variables.toolDirName }}/index.mjs

            templateContext:
              type: releaseJob
              isProduction: true
              inputs:
                - input: pipelineArtifact
                  artifactName: ${{ variables.artifactName }}
                  targetPath: $(artifactPath)

            steps:
              - task: UseNode@1
                displayName: Install Node.js 24
                inputs:
                  version: 24.x

              # Get credentials that will be used to temporarily upload zips to the staging storage account
              # in your team's Azure subscription
              - task: AzureCLI@2
                displayName: Get credentials for staging blob storage
                inputs:
                  azureSubscription: <staging service connection name>
                  scriptType: bash
                  scriptLocation: inlineScript
                  addSpnToEnvironment: true
                  inlineScript: |
                    echo "##vso[task.setvariable variable=STAGING_TENANT_ID]$tenantId"
                    echo "##vso[task.setvariable variable=STAGING_CLIENT_ID]$servicePrincipalId"
                    echo "##vso[task.setvariable variable=STAGING_ID_TOKEN;issecret=true]$idToken"

              # Fetch ESRP certificates from the production tenant key vault
              - task: AzureKeyVault@2
                displayName: Get ESRP certificates from Key Vault
                inputs:
                  azureSubscription: <ESRP service connection name>
                  KeyVaultName: <key vault name>
                  SecretsFilter: <auth cert name>,<request signing cert name>

              # Run the tool (see "Tool inputs" below for details on each variable)
              - script: node '$(toolArtifactBin)'
                displayName: Publish using ESRP Release API
                retryCountOnTaskFailure: 3
                env:
                  PACKED_PACKAGES_PATH: $(packagesArtifactPath)

                  # Staging storage credentials
                  STAGING_STORAGE_ACCOUNT_NAME: <storage account name>
                  # set above by AzureCLI@2 but must be mapped in
                  STAGING_CLIENT_ID: $(STAGING_CLIENT_ID)
                  STAGING_TENANT_ID: $(STAGING_TENANT_ID)
                  STAGING_ID_TOKEN: $(STAGING_ID_TOKEN)

                  # ESRP credentials (certs fetched above by AzureKeyVault@2)
                  ESRP_AUTH_CERT: $(<auth cert name>)
                  ESRP_REQUEST_SIGNING_CERT: $(<request signing cert name>)
                  ESRP_TENANT_ID: <production tenant ID>
                  ESRP_CLIENT_ID: <ESRP app registration client ID>

                  # Release info (must be unique per invocation if publishing multiple times per build)
                  ESRP_PRODUCT_NAME: <friendly product name>
                  ESRP_NPM_TAG: <npm dist-tag> # optional
                  ESRP_USER: <email>
                  ESRP_CREATED_BY: <email> # optional if ESRP_USER is set
                  ESRP_APPROVERS: <email> # optional if ESRP_USER is set
                  ESRP_OWNERS: <email> # optional if ESRP_USER is set
                  ESRP_DRI_EMAIL: <email> # optional if ESRP_USER is set
```

</details>

## Tool inputs

The tool is configured using environment variables. All variables are **required** unless noted otherwise. See previous section for a full example.

### Packages and release info

> ⚠️ If you invoke the tool multiple times in the same pipeline to publish different sets of packages, each invocation must use a different `ESRP_PRODUCT_NAME` or `ESRP_NPM_TAG`. Otherwise the invocations share the same [retry state](#storage-account-and-lifecycle-policy) and later ones will incorrectly assume their packages were already published.

<!-- prettier-ignore -->
| Variable | Description |
| -------- | ----------- |
| `PACKED_PACKAGES_PATH` | Path to the [packed packages](#packed-packages-format) directory. |
| `ESRP_PRODUCT_NAME` | Friendly product name for the release. This is **not** used as a published package name, just in the ESRP Release UI (and by the tool as a state key). |
| `ESRP_NPM_TAG` | _Optional._ npm dist-tag for the published packages. Defaults to `latest` or uses each package's `publishConfig`. |

### Contact info

`ESRP_USER` is optional and provides a default value for all the other fields in this group (so those become optional if it's set).

<!-- prettier-ignore -->
| Variable | Description |
| -------- | ----------- |
| `ESRP_USER` | _Optional._ Default value for the fields below. |
| `ESRP_CREATED_BY` | Email of the user creating the release. |
| `ESRP_DRI_EMAIL` | Email of the DRI for the team creating the release. |
| `ESRP_OWNERS` | Owner email(s), comma-separated. |
| `ESRP_APPROVERS` | Approver email(s), comma-separated (all non-mandatory and auto-approved). |

### ESRP resources

ESRP resources are set up per their guides. Correspondence with official `EsrpRelease` task input names is given to assist with cross-referencing their docs.

<!-- prettier-ignore -->
| Variable | Description |
| -------- | ----------- |
| `ESRP_TENANT_ID` | Production tenant ID for your ESRP app registration. (`EsrpRelease` task: `domaintenantid`) |
| `ESRP_CLIENT_ID` | Client ID for your production tenant ESRP app registration. (`EsrpRelease` task: `clientid`) |
| `ESRP_AUTH_CERT` | Base64-encoded PFX certificate for authenticating to ESRP AAD. |
| `ESRP_REQUEST_SIGNING_CERT` | Base64-encoded PFX certificate for signing JWS release requests. |

The certificates are typically retrieved by a prior `AzureKeyVault` task step (as shown in the example pipeline above):

```yml
- task: AzureKeyVault@2
  displayName: Get ESRP certificates from Key Vault
  inputs:
    # Production tenant service connection name (EsrpRelease task: "connectedservicename")
    azureSubscription: <ESRP service connection name>
    # Key vault name (EsrpRelease task: "keyvaultname")
    KeyVaultName: <key vault name>
    # Cert content is loaded into secret variables (EsrpRelease task: "authcertname" and "signcertname")
    SecretsFilter: <auth cert name>,<request signing cert name>
```

### Staging resources

See [staging resource setup](#staging-resource-setup).

<!-- prettier-ignore -->
| Variable | Description |
| -------- | ----------- |
| `STAGING_STORAGE_ACCOUNT_NAME` | Name of the [staging storage account](#staging-resource-setup). |
| `STAGING_CLIENT_ID` | Client ID used for storage account access. |
| `STAGING_TENANT_ID` | Tenant ID used for storage account access. |
| `STAGING_ID_TOKEN` | Federated ID token used for storage account access. |

Aside from `STAGING_STORAGE_ACCOUNT_NAME`, these are typically retrieved by a prior `AzureCLI` task step (as shown in the example pipeline above):

```yml
- task: AzureCLI@2
  displayName: Get credentials for staging blob storage
  inputs:
    azureSubscription: <staging service connection name>
    scriptType: bash
    scriptLocation: inlineScript
    addSpnToEnvironment: true
    inlineScript: |
      echo "##vso[task.setvariable variable=STAGING_TENANT_ID]$tenantId"
      echo "##vso[task.setvariable variable=STAGING_CLIENT_ID]$servicePrincipalId"
      echo "##vso[task.setvariable variable=STAGING_ID_TOKEN;issecret=true]$idToken"
```
