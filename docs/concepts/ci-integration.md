---
tags:
  - overview
category: doc
---

# CI integration

There are two parts to CI integration with `beachball`:

1. [Add a PR build step](./change-files#validating-change-files) to call `beachball check` to validate that change files are included.
2. Add a release build step to call `beachball publish` to publish to npm and push back to git (this page).

To automate the bumping of package versions based on change files, you'll need to configure your release workflow/pipeline so that `beachball publish` has write access to the git repo and npm registry. The exact steps will vary between CI systems, but general concepts as well as steps for some common setups are outlined below.

## Authentication

Automated publishing from a GitHub repo to the public npm registry (`registry.npmjs.org`) typically uses personal access tokens for authentication. These tokens are stored as secrets in your CI system. You should ensure that these secrets are only available to release builds.

For Azure DevOps repos publishing to a private registry, there are other possible approaches (such as using a service account with credentials stored in a key vault) which are not currently covered by these docs.

### Generating tokens

#### npm token

If publishing to the public npm registry (`registry.npmjs.org`), [create a granular access token](https://docs.npmjs.com/creating-and-viewing-access-tokens#creating-granular-access-tokens-on-the-website) with write access to **only** the relevant package(s) and/or scope(s). Classic automation tokens are not recommended due to their overly broad permissions.

#### GitHub token

Since a repo's `main`/`master` branch should be protected, this creates some difficulties for pushing changes back during automated publishing.

The main way to allow `beachball` to push back to a repo with branch protections is by using a [**fine-grained** personal access token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-fine-grained-personal-access-token) with write permissions for **only** the specific repo. (If the repo is in an org that doesn't allow persistent admin access, see [these instructions](https://github.com/microsoft/beachball/issues/1008).)

An alternative approach is creating a fine-grained PAT with a "machine user" account. Create a new account with an alternate email or [subaddress](https://en.wikipedia.org/wiki/Email_address#Subaddressing) (`+` address), give it contributor permissions to only this repo, and add it under "Restrict who can push to matching branches" in the branch protection rule.

(Note that the [built-in `GITHUB_TOKEN`](https://docs.github.com/en/actions/security-guides/automatic-token-authentication) won't work for publishing because that actor can't be given permission to bypass policies.)

### Storing tokens

<h4 id="secrets-github-actions">GitHub Actions</h4>

To restrict secret access to appropriate branches, use an **[environment](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment)**. (The docs for environments focus on cloud deployments or resources, but environments can also be used only for secret storage.)

1. [Create an environment](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment#creating-an-environment).
2. Restrict [deployment branches](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment#deployment-branches) to "Selected branches" and add a rule to allow only your release branch(es) (often `main`/`master`).
3. [Add secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets#creating-encrypted-secrets-for-an-environment) for the npm and GitHub tokens.
4. To [use the environment](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment#using-an-environment), add a key `environment: your-env-name` in your release workflow job. (Full example below.)

<h4 id="secrets-azure-pipelines">Azure Pipelines</h4>

There are a couple of options here:

- Use [secret variables in your release pipeline](https://learn.microsoft.com/en-us/azure/devops/pipelines/process/variables?view=azure-devops&tabs=yaml%2Cbatch#secret-variables).
- Use [secrets in a variable group](https://learn.microsoft.com/en-us/azure/devops/pipelines/library/variable-groups?view=azure-devops&tabs=classic), which can optionally be linked to a key vault. Ensure that this variable group is only accessible to your release pipeline.

## Setting options for publishing

If you're passing any custom options besides the npm token to `beachball publish`, it's recommended to set them in either the `beachball` config (if they don't interfere with other commands), or a `package.json` script (if specific to `publish`).

For example, the following script could be used for publishing public scoped packages:

```json
{
  "scripts": {
    "release": "beachball publish --access public"
  }
}
```

If you're publishing to a private feed, `registry` should be set in the overall `beachball` config, since it's also used by the `sync` command. For example, if your beachball config is in the root `package.json` (or it works the same in a config file):

```json
{
  "beachball": {
    "registry": "https://pkgs.dev.azure.com/some-org/_packaging/some-feed/npm/registry/"
  }
}
```

## Publishing

The exact publishing setup will vary depending on your CI setup, but the overall steps are as follows:

1. Ensure the git user name and email are set, or git will reject the commit. Somewhere in your pipeline:
   ```bash
   git config user.name "someone"
   git config user.email "someone@example.com"
   ```
2. Set up git authentication. This could use tokens (covered below), SSH keys, or some other non-interactive method.
3. Set up npm authentication. This could use tokens passed on the command line (covered below), tokens set in `.npmrc`, or some other method.
4. Run `beachball publish`!

### GitHub repo + GitHub Actions

Here's a sample setup for publishing from a GitHub repo using GitHub actions. The environment, secret, and script names can be modified as you prefer.

This sample assumes the following:

- An environment called `release` (set up [as described above](#storing-tokens)) with the following secrets:
  - `REPO_PAT`: A GitHub fine-grained personal access token with write access ([as described above](#github-token))
  - `NPM_TOKEN`: An npm token with write access to the package(s) and/or scope(s), such as a [fine-grained token for public npm](#npm-token)
- A repo root `package.json` script `release` which runs `beachball publish`
- The build is running on a Linux/Mac agent. (This could be easily adapted to a Windows agent with different syntax in the commands.)

Note that in GitHub Actions, it's easiest to set up authentication if you set `persist-credentials: false` when checking out code.

```yml
# Example trigger configurations (choose one or more, or another setup)
# on:
#   # Release on push to main
#   push:
#     branches: [main]
#   # Release daily (see https://crontab-generator.org/ for help with schedules)
#   schedule:
#     - cron: '0 8 * * *'
#   # Release on manual trigger (can be used alone or with other options)
#   workflow_dispatch:

environment: release

# Variable syntax below assumes Linux/Mac but could be easily adapted to Windows
runs-on: ubuntu-latest

steps:
  - name: Check out code
    uses: actions/checkout@v3
    with:
      # Prevent the action from storing credentials in a way that's hard to override
      persist-credentials: false

  # ... Other steps to prepare for publishing (install, build, test, etc) ...

  # Set the name, email, and URL with PAT
  - name: Set git credentials
    run: |
      git config user.name "someone"
      git config user.email "someone@example.com"
      git remote set-url origin "https://$REPO_PAT@github.com/your-org/your-repo"
    env:
      REPO_PAT: ${{ secrets.REPO_PAT }}

  # Pass the token on the command line for publishing
  - name: Publish
    run: npm run release -- --token "$NPM_TOKEN"
    env:
      NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### GitHub repo + Azure Pipelines

Here's a sample setup for publishing from a GitHub repo using Azure Pipelines. The environment, secret, and script names can be modified as you prefer.

This sample assumes the following:

- A variable group called `Beachball secrets` (set up [as described above](#secrets-azure-pipelines)) with the following secrets:
  - `REPO_PAT`: A GitHub fine-grained personal access token with write access ([as described above](#github-token))
  - `NPM_TOKEN`: An npm token with write access to the package(s) and/or scope(s), such as a [fine-grained token for public npm](#npm-token)
- A repo root `package.json` script `release` which runs `beachball publish`
- The build is running on a Linux/Mac agent. (This could be easily adapted to a Windows agent with different syntax in the commands.)

```yml
# Example trigger configurations (choose one or more, or another setup)
#
# # Release on push to main
# trigger: [main]
#
# # Release on a schedule
# # https://docs.microsoft.com/en-us/azure/devops/pipelines/build/triggers?tabs=yaml&view=azure-devops#supported-cron-syntax
# schedules:
#   - cron: '0 8 * * *'
#     branches:
#       include: [main]

# This group should only be accessible to the release pipeline
variables:
  - group: Beachball secrets

# Variable syntax below assumes Linux/Mac but could be easily adapted to Windows
pool:
  vmImage: ubuntu-latest

steps:
  # ... Other steps to set up repo and prepare for publishing (install, build, test, etc) ...

  # Set the name, email, and URL with PAT
  - script: |
      git config user.name "someone"
      git config user.email "someone@example.com"
      git remote set-url origin "https://$(REPO_PAT)@github.com/your-org/your-repo"
    name: Set git credentials

  # Pass the token on the command line for publishing
  - script: npm run release -- --token "$(NPM_TOKEN)"
    name: Publish
```

### Azure Repos + Azure Pipelines

This should be very similar to the GitHub version, aside from possibly the authentication method. You could potentially use personal access tokens for git and npm feed authentication (similar to above), or other methods are available which aren't currently covered here.

If you're publishing to a private Azure Artifacts npm feed, be sure to set `registry` in the `beachball` config [as described above](#setting-options-for-publishing).
