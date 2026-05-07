# @microsoft/esrp-npm-release

Helper for teams within Microsoft that would like to [use ESRP to release npm packages](https://eng.ms/docs/microsoft-security/identity/trust-and-security-services/tss-release-distribute/tss-release-esrp-parent/oss-publishing/releasing-open-source/npmjs) in the correct order.

This tool replaces the `EsrpRelease` ADO task with a direct ESRP API integration that (when used together with `beachball`) respects dependency-topological ordering of packages. This means that if publishing fails partway through, or someone accidentally installs a new version while publishing is still in progress, there will never be any dependency references to package versions that don't yet exist on the registry.

One unfortunate thing about using the API is that it only accepts blob storage URLs, so it requires an extra step of temporarily uploading files to a "staging" storage account. This tool automates that process (including cleanup), but you'll need to create an extra storage account and service connection.

## Prerequisites

- Output folder from `beachball publish --pack-to-path <path> --pack-style layer` or in the same format. The folder should contain numbered subdirectories, each containing `.tgz` files in dependency-topological layers.
- ESRP Azure resources configured per their guides
  - An ESRP-onboarded app registration in a production tenant (need client ID and tenant ID)
  - Production tenant key vault storing the ESRP auth certificate and request signing certificate (PFX format, base64-encoded)
  - Azure Resource Manager service connection with access to the app registration and key vault
- Specific to this tool: staging resources
  - Azure Blob Storage account in your team's subscription to temporarily host zips of packages
  - Azure Resource Manager service connection with access to the storage account

## Pipeline setup

This tool is designed to run in an Azure DevOps release pipeline using [1ES Pipeline Templates](https://eng.ms/docs/coreai/devdiv/one-engineering-system-1es/1es-docs/1es-pipeline-templates/overview). The typical setup uses two pipelines:

### Prepublish pipeline (CI/build)

The prepublish pipeline builds the repo, packs the packages, and publishes them as a pipeline artifact. It should:

1. Build and test the repo
2. Run `beachball publish --pack-to-path '$(Build.StagingDirectory)/published-packages' --pack-style layer` to create a folder with numbered subdirectories containing package `.tgz` files in dependency-topological layers
3. Publish two pipeline artifacts via `templateContext.outputs`:
   - `published-packages`: the packed `.tgz` files (the output of `--pack-to-path`)
   - `release-api-tool`: the bundled `dist/index.js` from this package

See https://github.com/microsoft/beachball/blob/main/.ado/publish.yml for a full example.

```yaml
templateContext:
  outputs:
    - output: pipelineArtifact
      artifactName: published-packages
      targetPath: $(Build.StagingDirectory)/published-packages
    - output: pipelineArtifact
      artifactName: release-api-tool
      # or the appropriate path in your repo
      targetPath: $(Build.SourcesDirectory)/node_modules/@microsoft/esrp-npm-release/dist/index.js
```

### Release pipeline

The release pipeline is triggered on prepublish pipeline completion, downloads the artifacts from the prepublish pipeline, and runs this tool.

The job should be configured as a `releaseJob` with `isProduction: true` in `templateContext`. It downloads the packed packages and tool as pipeline artifact inputs, and publishes retry state as an output.

Be sure to fill in all the `<placeholders>`! See https://github.com/microsoft/beachball/blob/main/.ado/release.yml for a full example.

```yaml
resources:
  pipelines:
    # "prepublish" is an arbitrary name which must match publishPipelineAlias below
    - pipeline: prepublish
      project: <your ADO project>
      source: <publish pipeline name from the UI>
      trigger:
        branches:
          include:
            - main

variables:
  publishPipelineAlias: prepublish
  packagesArtifactName: published-packages
  releaseApiToolArtifactName: release-api-tool

extends:
  template: <1ES PT template>
  parameters:
    pool:
      name: <pool name>
      vmImage: windows-latest
      os: windows

    stages:
      - stage: main_release
        displayName: Publish packages
        jobs:
          - job: npm_release
            displayName: NPM to npmjs.com
            templateContext:
              type: releaseJob
              isProduction: true
              inputs:
                - input: pipelineArtifact
                  pipeline: ${{ variables.publishPipelineAlias }}
                  artifactName: ${{ variables.packagesArtifactName }}
                  targetPath: $(Agent.BuildDirectory)\${{ variables.packagesArtifactName }}
                - input: pipelineArtifact
                  pipeline: ${{ variables.publishPipelineAlias }}
                  artifactName: ${{ variables.releaseApiToolArtifactName }}
                  targetPath: $(Agent.BuildDirectory)\${{ variables.releaseApiToolArtifactName }}
              outputs:
                # Track which layers have been processed across stage retries
                - output: pipelineArtifact
                  targetPath: $(Agent.BuildDirectory)/artifacts_processed_$(System.StageAttempt)/artifacts_processed_$(System.StageAttempt).txt
                  artifactName: artifacts_processed_$(System.StageAttempt)
                  displayName: Publish the artifacts processed for this stage attempt
                  sbomEnabled: false
                  isProduction: false
                  condition: always()

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
                  azureSubscription: <release service connection name>
                  KeyVaultName: <key vault name>
                  SecretsFilter: <auth cert name>,<request signing cert name>

              # Run the tool
              - script: node $(Agent.BuildDirectory)\${{ variables.releaseApiToolArtifactName }}\index.js
                displayName: Publish using ESRP Release API
                retryCountOnTaskFailure: 3
                env:
                  STAGING_STORAGE_ACCOUNT_NAME: <storage account name>
                  STAGING_CLIENT_ID: $(STAGING_CLIENT_ID)
                  STAGING_TENANT_ID: $(STAGING_TENANT_ID)
                  STAGING_ID_TOKEN: $(STAGING_ID_TOKEN)
                  ESRP_AUTH_CERT: $(<auth cert name>)
                  ESRP_REQUEST_SIGNING_CERT: $(<request signing cert name>)
                  ESRP_TENANT_ID: <production tenant ID>
                  ESRP_CLIENT_ID: <ESRP app registration client ID>
                  PACKED_PACKAGES_PATH: $(Agent.BuildDirectory)\${{ variables.packagesArtifactName }}

                  # Configure release info
                  ESRP_PRODUCT_NAME: <friendly product name>
                  ESRP_NPM_TAG: <npm dist-tag> # optional, default "latest" or inferred from publishConfig
                  # ESRP_USER is optional and provides a default value for other user-related options
                  ESRP_USER: <email>
                  ESRP_CREATED_BY: <email> # optional if ESRP_USER is set
                  ESRP_APPROVERS: <email> # auto-approved; comma-separated; optional if ESRP_USER is set
                  ESRP_OWNERS: <email> # comma-separated; optional if ESRP_USER is set
                  ESRP_DRI_EMAIL: <email> # optional if ESRP_USER is set
```

## How it works

1. **Authenticates** with Azure Blob Storage using a federated ID token
2. **Loads retry state** from previous stage attempts (if any) to skip already-published layers
3. **Iterates layers** in order. For each layer:
   - Zips all `.tgz` files in the layer directory
   - Acquires a blob lease to prevent concurrent releases
   - Uploads the zip to Azure Blob Storage
   - Submits an ESRP release request with a JWS-signed token
   - Polls for release completion (up to 60 minutes)
   - Cleans up the staging blob (also on failure)
   - Records the layer as done (persisted to disk for retry resilience)
4. **Publishes state** as a pipeline artifact so retried stage attempts can resume from where a previous attempt left off
