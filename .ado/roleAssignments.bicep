/*
Apply changes:
  az deployment group create \
    --subscription "<sub>" \
    --resource-group "<rg>" \
    --template-file .ado/roleAssignments.bicep \
    --parameters \
        stagingStorageName=<storage> \
        managedIdentityName=<uami-name>

Preview changes:
  az deployment group what-if ...
*/

@description('Name of the user-assigned managed identity to create and grant storage roles to.')
param managedIdentityName string

@description('Name of the storage account used for temporary storage of package artifacts and state.')
param stagingStorageName string

// Built-in role definition IDs.
// See https://learn.microsoft.com/en-us/azure/role-based-access-control/built-in-roles
var roleDefinitions = {
  storageBlobDataContributor: 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'
  storageBlobDelegator: 'db58b8e5-c6ad-4a2a-8342-4190687cbf4a'
}

// If an account with this name already exists in the resource group, the deployment reconciles
// its properties to match the values below — make sure they match the existing account, or run
// `what-if` first to preview.
resource stagingStorage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: stagingStorageName
  location: resourceGroup().location
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'
  }
  properties: {
    accessTier: 'Hot'
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
  }
}

// User-assigned managed identity that will be granted storage roles below.
// UAMIs are service principals as far as role assignments are concerned.
resource uami 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: managedIdentityName
  location: resourceGroup().location
}

resource blobDataContrib 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: stagingStorage
  name: guid(stagingStorage.id, managedIdentityName, 'StorageBlobDataContributor')
  properties: {
    principalId: uami.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      roleDefinitions.storageBlobDataContributor
    )
  }
}

resource blobDelegator 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: stagingStorage
  name: guid(stagingStorage.id, managedIdentityName, 'StorageBlobDelegator')
  properties: {
    principalId: uami.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      roleDefinitions.storageBlobDelegator
    )
  }
}

// Garbage-collect staged release artifacts and release-state markers.
// The tool deletes staging blobs in a finally block after each release, but stragglers
// can be left behind if the process is killed mid-release. release-state markers are
// never deleted by the tool and would otherwise accumulate forever.
resource lifecyclePolicy 'Microsoft.Storage/storageAccounts/managementPolicies@2023-05-01' = {
  parent: stagingStorage
  name: 'default'
  properties: {
    policy: {
      rules: [
        {
          name: 'expire-staging-blobs'
          enabled: true
          type: 'Lifecycle'
          definition: {
            filters: {
              blobTypes: ['blockBlob']
              prefixMatch: ['staging/']
            }
            actions: {
              baseBlob: {
                delete: { daysAfterModificationGreaterThan: 3 }
              }
            }
          }
        }
        {
          name: 'expire-release-state'
          enabled: true
          type: 'Lifecycle'
          definition: {
            filters: {
              blobTypes: ['blockBlob']
              prefixMatch: ['release-state/']
            }
            actions: {
              baseBlob: {
                delete: { daysAfterModificationGreaterThan: 90 }
              }
            }
          }
        }
      ]
    }
  }
}
