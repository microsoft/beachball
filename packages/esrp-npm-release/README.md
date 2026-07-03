# @microsoft/esrp-npm-release

Helper for teams within Microsoft that would like to use ESRP to release npm packages in the correct order.

This tool replaces the `EsrpRelease` ADO task with a direct ESRP API integration that (when used together with `beachball`) respects **dependency-topological ordering** of packages. This means that if publishing fails partway through, or someone accidentally installs a new version while publishing is still in progress, there will never be any dependency references to package versions that don't yet exist on the registry. The tool also supports retrying the release stage in ADO without repeating already-published layers.

One unfortunate thing about using the ESRP API is that it only accepts blob storage URLs, so it requires an extra step of temporarily uploading files to a "staging" storage account. This tool automates that process (including cleanup), but you'll need to create an extra storage account and service connection.

## Overview

This tool relies on the following:

- Output folder from `beachball publish --pack-to-path <path>` or [in the same format](#packed-packages-format)
- ESRP Azure resources configured per their guides (see docs on eng.ms)
  - An ESRP-onboarded app registration in a production tenant (need client ID and tenant ID)
  - Production tenant key vault storing the ESRP auth certificate and request signing certificate (PFX format, base64-encoded)
  - ADO Azure Resource Manager service connection with access to the app registration and key vault
- Specific to this tool: [staging resources](#staging-storage-account-setup)
  - Azure Blob Storage account in your team's subscription (in the corp tenant) to temporarily host zips of packages
  - Managed identity with the right RBAC roles on the storage account
  - ADO Azure Resource Manager service connection configured to use that identity

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

## Staging storage account setup

This tool needs an Azure Blob Storage account in a subscription you control to:

- Temporarily host the zipped layers (in a container named `staging`) so ESRP can download them via SAS URL.
- Persist retry state (in a container named `release-state`) so ADO stage retries can resume from where a previous attempt left off.

Both containers are created on demand by the tool — you don't need to pre-create them.

The Bicep template at [`.ado/roleAssignments.bicep`](https://github.com/microsoft/beachball/blob/main/.ado/roleAssignments.bicep) provisions everything in one shot: the storage account itself, a user-assigned managed identity, the required RBAC role assignments, and a lifecycle management policy.

The commands below reuse the same subscription, resource group, storage account, and managed identity names, so set them once in your shell to keep the snippets copy-pasteable:

```bash
SUBSCRIPTION="<sub>"
RESOURCE_GROUP="<rg>"
STORAGE_ACCOUNT="<storage>"
MANAGED_IDENTITY="<uami-name>"
```

### 1. Create the resource group

Resource groups aren't created by the Bicep template. Either use an existing group, or run the command below to create a new one. (To see available locations: `az account list-locations --output tsv --query "[].name"`)

```bash
az group create \
  --subscription "$SUBSCRIPTION" \
  --name "$RESOURCE_GROUP" \
  --location <location>
```

### 2. Deploy the Bicep template

This creates the storage account, a user-assigned managed identity, the two required data-plane role assignments, and a blob lifecycle policy (see [the notes below](#about-the-rbac-roles-and-lifecycle-policy) for what each piece is for).

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

The deployment is idempotent — re-running it reconciles drift in the storage account properties, role assignments, and lifecycle policy. The storage account name will be passed to the tool as `STAGING_STORAGE_ACCOUNT_NAME`.

#### About the RBAC roles and lifecycle policy

The template assigns two **data-plane** roles to the managed identity at the storage account scope. Control-plane roles like `Contributor` or `Owner` are **not sufficient** — without the roles below, you'd see a 403 error like "This request is not authorized to perform this operation using this permission" the first time the tool tried to list or write a blob.

- **Storage Blob Data Contributor**: List, read, write, and delete blobs in the `staging` and `release-state` containers, and create the containers on first use.
- **Storage Blob Delegator**: Mint short-lived user-delegation SAS tokens that ESRP uses to download staged zips.

RBAC propagation usually takes less than five minutes. If a freshly-assigned role still produces 403s, wait a few minutes and retry.

The template also configures an [Azure Storage lifecycle management policy](https://learn.microsoft.com/azure/storage/blobs/lifecycle-management-overview) on the staging storage account. It cleans up `release-state` blobs automatically after (as of writing) 90 days, and `staging` blobs after 3 days. (The release tool attempts to delete the `staging` blobs immediately after the release, but the policy provides a fallback.)

### 3. Create a service connection

In your ADO project, create an **Azure Resource Manager** service connection:

- **Identity type**: Managed identity (automatically configures Workload Identity Federation)
- **Managed identity details**: Choose your subscription, resource group, and identity
- **Azure scope**: Choose the same subscription and resource group
- **Service Connection Name**: Choose any name and make note of it for later

The release stage (later) passes the connection's name to `AzureCLI@2` as `azureSubscription`. It uses the option `addSpnToEnvironment: true` to obtain a federated `idToken` that this tool exchanges for an AAD access token at runtime — there are no long-lived secrets to manage.

## Pipeline setup

This tool is designed to run in Azure DevOps using [1ES Pipeline Templates](https://eng.ms/docs/coreai/devdiv/one-engineering-system-1es/1es-docs/1es-pipeline-templates/overview). The recommended setup is a single pipeline with separate build and release stages.

### Prerequisite: Internal feed setup

Production pipeline template policies restrict network access, so it's necessary to configure the build stage to use an internal npm feed. These steps assume `yarn`, but most of them also apply to `npm` and `pnpm` with some modifications.

1. Choose a feed in your project (or create a new one) that has the public npm registry as an upstream source, and note its URL.
1. Create a file `.npmrc.publish` at the repo root with the corresponding `registry` setting: e.g. `registry=https://pkgs.dev.azure.com/office/_packaging/Office/npm/registry/`
1. Add `.npmrc` to `.gitignore`
1. For `yarn` 4, add and commit the plugin [`yarn-plugin-npmrc`](https://github.com/ecraig12345/yarn-plugins/tree/main/plugins/npmrc) so that `yarn` will pick up credentials from `.npmrc` (but don't set the `npmrcAuthEnabled` setting)
1. Make a copy of [`scripts/preparePublishRegistry.ts`](https://github.com/microsoft/beachball/blob/main/scripts/preparePublishRegistry.ts) in your repo. It must run before deps are installed: it copies `.npmrc.publish` to `.npmrc`, and updates `.yarnrc.yml` with registry and auth settings.
   - If using `npm` or `pnpm`, modify as needed. If the manager saves resolved URLs in the lock file, you'll also need a step to update those to point to the private registry.

#### Pipeline file

The pipeline has two stages:

1. **build**: builds the repo, packs the packages, and publishes pipeline artifacts consumed by the release stage.
2. **publish**: runs the release tool to publish the packages via ESRP. The release stage should always use a separate `releaseJob` (with `isProduction: true`) and consume build outputs as `pipelineArtifact` inputs instead of running checkout/package restore directly in the release job.

Be sure to fill in all the `<placeholders>`! See https://github.com/microsoft/beachball/blob/main/.ado/release.yml for a full example.

TODO: add info about how to update committed files post-publish

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
  packagesArtifactName: packed-packages
  releaseApiToolArtifactName: release-api-tool

extends:
  template: <1ES PT template>
  parameters:
    pool:
      name: <pool name>
      vmImage: windows-latest
      os: windows # some scans require windows

    stages:
      # divide and name stages and jobs as desired
      - stage: build
        displayName: Build artifacts
        jobs:
          - job: build
            displayName: Build, test, pack

            pool:
              name: Azure-Pipelines-1ESPT-ExDShared
              # could also use windows
              image: ubuntu-latest
              os: linux

            workspace:
              clean: all

            templateContext:
              outputs:
                # your packed packages
                - output: pipelineArtifact
                  artifactName: ${{ variables.packagesArtifactName }}
                  targetPath: $(Build.StagingDirectory)/packed-packages
                # the release tool so it doesn't need to be installed (update path as needed)
                - output: pipelineArtifact
                  artifactName: ${{ variables.releaseApiToolArtifactName }}
                  targetPath: $(Build.SourcesDirectory)/node_modules/@microsoft/esrp-npm-release/dist/index.js

            steps:
              - checkout: self

              - task: UseNode@1
                displayName: Install Node.js ${{ variables.nodeVersion }}
                retryCountOnTaskFailure: 1
                inputs:
                  version: ${{ variables.nodeVersion }}.x
                  checkLatest: false

              # Configure the private registry (update script path as needed)
              - script: node scripts/preparePublishRegistry.ts
                displayName: Prepare npm registry settings

              # Authenticate with the private registry, using .npmrc.publish copied to .npmrc
              - task: npmAuthenticate@0
                displayName: npm authenticate
                inputs:
                  workingFile: $(Build.SourcesDirectory)/.npmrc

              # This isn't used, it's just a clear way to check that auth is working
              # (yarn install's auth errors can be very unclear)
              - script: yarn npm info beachball
                displayName: Get package to verify registry auth

              - script: yarn --immutable
                displayName: Install dependencies

              # TODO: insert steps to run your build, tests, etc

              # Bump and pack packages (update command and registry as needed).
              # This could also run some other script that outputs packages in the same format.
              # TODO read registry from npmrc
              - script: yarn beachball bump --pack-to-path '$(Build.StagingDirectory)/packed-packages' --registry https://pkgs.dev.azure.com/office/_packaging/Office/npm/registry/
                displayName: Pack packages

      - stage: release
        displayName: Publish packages
        dependsOn: build
        jobs:
          - job: npm_release
            displayName: NPM to npmjs.com
            templateContext:
              type: releaseJob
              isProduction: true
              inputs:
                - input: pipelineArtifact
                  artifactName: ${{ variables.packagesArtifactName }}
                  targetPath: $(Agent.BuildDirectory)\${{ variables.packagesArtifactName }}
                - input: pipelineArtifact
                  artifactName: ${{ variables.releaseApiToolArtifactName }}
                  targetPath: $(Agent.BuildDirectory)\${{ variables.releaseApiToolArtifactName }}

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
                  scriptType: pscore
                  scriptLocation: inlineScript
                  addSpnToEnvironment: true
                  inlineScript: |
                    Write-Host "##vso[task.setvariable variable=STAGING_TENANT_ID]$env:tenantId"
                    Write-Host "##vso[task.setvariable variable=STAGING_CLIENT_ID]$env:servicePrincipalId"
                    Write-Host "##vso[task.setvariable variable=STAGING_ID_TOKEN;issecret=true]$env:idToken"

              # Fetch ESRP certificates from the production tenant key vault
              - task: AzureKeyVault@2
                displayName: Get ESRP certificates from Key Vault
                inputs:
                  azureSubscription: <ESRP service connection name>
                  KeyVaultName: <key vault name>
                  SecretsFilter: <auth cert name>,<request signing cert name>

              # Run the tool
              - script: node $(Agent.BuildDirectory)\${{ variables.releaseApiToolArtifactName }}\index.js
                displayName: Publish using ESRP Release API
                retryCountOnTaskFailure: 3
                env:
                  PACKED_PACKAGES_PATH: $(Agent.BuildDirectory)\${{ variables.packagesArtifactName }}

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

                  # Release info
                  ESRP_PRODUCT_NAME: <friendly product name>
                  ESRP_NPM_TAG: <npm dist-tag> # optional, default "latest" or inferred from publishConfig
                  # ESRP_USER is optional and provides a default value for other user-related options
                  ESRP_USER: <email>
                  ESRP_CREATED_BY: <email> # optional if ESRP_USER is set
                  ESRP_APPROVERS: <email> # auto-approved; comma-separated; optional if ESRP_USER is set
                  ESRP_OWNERS: <email> # comma-separated; optional if ESRP_USER is set
                  ESRP_DRI_EMAIL: <email> # optional if ESRP_USER is set
```
