# @microsoft/esrp-npm-release

Helper for Microsoft teams that would like to use the ESRP Release API to release npm packages in topological order.

## Prerequisites

<!-- TODO: expand instructions -->

- Output folder from `beachball publish --pack-to-path <path> --pack-style layer` or in the same format
- ESRP service connection same as you'd use with the ADO task
- Azure Blob Storage account to temporarily host the package files (the API only accepts blob storage URLs)
