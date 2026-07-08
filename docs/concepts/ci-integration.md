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

## Setting options for publishing

Most [`beachball publish` options](../cli/publish#options) such as `--access` and `--registry` can be set in the [`beachball` config](../overview/configuration) if they don't interfere with other commands. (If you're publishing to a private feed, `registry` should be set in the config, since it's also used by the `sync` command.) For example:

```js
/** @type {Partial<import('beachball').RepoOptions>} */
const config = {
  // this should almost always be set
  access: 'public',
  // only set if a custom registry is needed
  registry: 'https://pkgs.dev.azure.com/some-org/_packaging/some-feed/npm/registry/',
  // ... other options ...
};
module.exports = config;
```

If you need to set options that are specific to publishing, it's recommended to set them in a `package.json` script. For example, the following script could be used to customize the commit message for publishing, avoiding a conflict with the `--message` arg for `change`:

```json
{
  "scripts": {
    "release": "beachball publish --message \"Bump package versions\""
  }
}
```

For a dynamic commit message (for example including version numbers), you can set the [`commitMessage` config option](../overview/configuration) to a function instead.

Providing the npm token (`--token` or `-n`) on the command line is no longer recommended. See [npm authentication](#npm-authentication) below for alternatives.

## Authentication

In the most common workflow, `beachball publish` requires authenticating with:

- [`npm` to publish packages](#npm-authentication)
- [`git` to push changes](#git-authentication) (version bumps, changelog updates, change file cleanup) back to the target branch

If using personal access tokens for authentication, they should have the minimum necessary permissions and be [stored as secrets](#storing-secrets) that are only available to release builds.

### npm authentication

#### Trusted publishing (preferred)

If publishing to the public npm registry (`registry.npmjs.org`) from GitHub Actions or another supported CI platform, you should [configure trusted publishing](https://docs.npmjs.com/trusted-publishers) instead of using a token. (Azure DevOps isn't supported as of June 2026, so in that case you'll need to [use a token](#token-based-authentication).)

With trusted publishing, no extra npm auth configuration is needed for `beachball publish`.

#### Token-based authentication

If publishing to the public npm registry (`registry.npmjs.org`) from Azure DevOps or another CI platform that doesn't support trusted publishing, [create a granular access token](https://docs.npmjs.com/creating-and-viewing-access-tokens) with write access to **only** the relevant package(s) and/or scope(s), and [store it as a secret](#storing-secrets).

Token authentication can potentially also be used for publishing to private registries, but setup details will vary.

To pass an npm token to `beachball publish`, do one of the following:

- Set the `NPM_TOKEN` environment variable while running `beachball publish`
- Manually set the token in [`.npmrc`](https://docs.npmjs.com/cli/v11/configuring-npm/npmrc#auth-related-configuration), possibly referencing an environment variable
- Old way (not recommended): use `--token <token>` on the command line

#### Other approaches

For Azure DevOps repos publishing to a private registry, the most common approach is to run the `npmAuthenticate` task prior to `beachball publish` (which will pick up that credential automatically). Alternatively, you can pass a token using one of the approaches described in the previous section.

If manually running `beachball publish` locally, you can run `npm login` beforehand, and `beachball` will use those credentials.

### git authentication

By default, `beachball publish` pushes changes (version bumps, changelog updates, change file cleanup) back to `main`/`master` or the configured `branch` option. Since this branch should be protected, there's typically some extra configuration needed for pushing changes back during automated publishing.

#### GitHub repos

The [built-in `GITHUB_TOKEN`](https://docs.github.com/en/actions/security-guides/automatic-token-authentication) can't be given permission to bypass branch protection rules, so you'll need to manually create credentials using one of the following approaches:

- Traditional approach: use a [**fine-grained personal access token**](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-fine-grained-personal-access-token) (PAT) with write permissions for **only** the specific repo, and store it [as a secret](#storing-secrets).
  - The user creating the token must have admin access or permission to bypass branch protection rules.
  - Variant: create a fine-grained PAT with a "machine user" account. Create a new account with an alternate email or [subaddress](https://en.wikipedia.org/wiki/Email_address#Subaddressing) (`+` address), give it contributor permissions to only this repo, and give it permission to bypass rules.
- Alternative: use a **GitHub app installation token**. For this purpose, an "app" is essentially just an _identity with permissions_; you don't need to define any logic or endpoints. Create a GitHub app, install it in your repo, and give it permission to bypass policies, then set up one of the following:
  - Any CI platform + Azure key vault: [beachball's `github-app-token` helper](https://github.com/microsoft/beachball/blob/main/packages/beachball/src/githubAuth/README.md)
  - GitHub Actions + Azure key vault: [`microsoft/create-github-app-token-via-key-vault`](https://github.com/microsoft/create-github-app-token-via-key-vault)
  - GitHub Actions + GitHub environment secrets: [`actions/create-github-app-token`](https://github.com/actions/create-github-app-token)

After creating the token, there are various ways it can be passed through to the `git` commands run within `beachball publish`. The most common approach is to set it as the git remote URL. For example, if the token is in an environment variable called `REPO_PAT`, and the remote is called `origin`:

```bash
git remote set-url origin "https://$REPO_PAT@github.com/your-org/your-repo"
# `git commit` also requires these to be set
git config user.name "someone"
git config user.email "someone@example.com"
# then some command to run beachball publish
```

#### Azure DevOps or other repos

For Azure DevOps repos publishing to a private registry, there are other possible approaches (such as using a service account with credentials stored in a key vault) which are not currently covered by these docs.

### Storing secrets

<h4 id="secrets-github-actions">GitHub Actions</h4>

To restrict secret access to appropriate branches, use an **[environment](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment)**. (The docs for environments focus on cloud deployments or resources, but environments can also be used only for secret storage.)

1. [Create an environment](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment#creating-an-environment).
2. Restrict [deployment branches](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment#deployment-branches) to "Selected branches" and add a rule to allow only your release branch(es) (e.g. `main`/`master`).
3. [Add secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets#creating-encrypted-secrets-for-an-environment) for the npm and GitHub tokens.
4. To [use the environment](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment#using-an-environment), add a key `environment: your-env-name` in your release workflow job. (Full example below.)

<h4 id="secrets-azure-pipelines">Azure Pipelines</h4>

There are a couple of options here:

- Use [secret variables in your release pipeline](https://learn.microsoft.com/en-us/azure/devops/pipelines/process/variables?view=azure-devops&tabs=yaml%2Cbatch#secret-variables).
- Use [secrets in a variable group](https://learn.microsoft.com/en-us/azure/devops/pipelines/library/variable-groups?view=azure-devops&tabs=classic), which can optionally be linked to a key vault. Ensure that this variable group is only accessible to your release pipeline.

## Publishing

The exact publishing setup will vary depending on your CI setup, but the overall steps are as follows:

1. Ensure the git user name and email are set, or git will reject the commit. Somewhere in your pipeline:
   ```bash
   git config user.name "someone"
   git config user.email "someone@example.com"
   ```
2. Set up git authentication. This could use tokens (covered below), SSH keys, or some other non-interactive method.
3. [Set up npm authentication](#npm-authentication) as described above.
4. Run `beachball publish`!

### GitHub repo + GitHub Actions

Here's a sample setup for publishing from a GitHub repo using GitHub actions. The environment, secret, and script names can be modified as you prefer.

This sample assumes the following:

- An environment called `release` (set up [as described above](#storing-secrets)) with the following secrets:
  - `REPO_PAT`: A GitHub fine-grained personal access token with write access ([as described above](#github-repos))
- [Trusted publishing](https://docs.npmjs.com/trusted-publishers) is enabled for the package(s), linked to this workflow, and given access to the `release` environment.
- A repo root `package.json` script `release` which runs `beachball publish`

Note that in GitHub Actions, it's easiest to set up authentication if you set `persist-credentials: false` when checking out code.

```yml
# Add trigger configuration of your choice (this one is manual only)
on:
  workflow_dispatch:

environment: release

# Variable syntax below assumes Linux/Mac but could be easily adapted to Windows
runs-on: ubuntu-latest

permissions:
  # Required for trusted publishing
  id-token: write

steps:
  - name: Check out code
    uses: actions/checkout@v6
    with:
      # Prevent the action from storing credentials in a way that's hard to override
      persist-credentials: false

  # ... Other steps to prepare for publishing (install, build, test, etc) ...

  # Set the name, email, and URL with PAT (use Windows variable syntax if needed)
  - name: Set git credentials
    run: |
      git config user.name "someone"
      git config user.email "someone@example.com"
      git remote set-url origin "https://$REPO_PAT@github.com/your-org/your-repo"
    env:
      REPO_PAT: ${{ secrets.REPO_PAT }}

  # No npm token needed with trusted publishing
  - name: Publish
    run: npm run release
```

### GitHub repo + Azure Pipelines

Here's a sample setup for publishing from a GitHub repo using Azure Pipelines. The environment, secret, and script names can be modified as you prefer.

This sample assumes the following:

- A variable group called `Beachball secrets` (set up [as described above](#secrets-azure-pipelines)) with the following secrets:
  - `REPO_PAT`: A GitHub fine-grained personal access token with write access ([as described above](#github-repos))
  - `NPM_TOKEN`: An npm token with write access to the package(s) and/or scope(s), such as a [fine-grained token for public npm](#trusted-publishing-preferred)
- A repo root `package.json` script `release` which runs `beachball publish`

```yml
# Add trigger configuration of your choice (this one is manual only)
pr: none
trigger: none

# This group should only be accessible to the release pipeline
variables:
  - group: Beachball secrets

# Variable syntax below assumes Linux/Mac but could be easily adapted to Windows
pool:
  vmImage: ubuntu-latest

steps:
  # ... Other steps to set up repo and prepare for publishing (install, build, test, etc) ...

  # Set the name, email, and URL with PAT (use Windows variable syntax if needed)
  - script: |
      git config user.name "someone"
      git config user.email "someone@example.com"
      git remote set-url origin "https://$REPO_PAT@github.com/your-org/your-repo"
    name: Set git credentials
    env:
      REPO_PAT: $(REPO_PAT)

  - script: npm run release
    name: Publish
    # Beachball will use this environment variable
    env:
      NPM_TOKEN: $(NPM_TOKEN)
```

### Azure Repos + Azure Pipelines

This should be very similar to the GitHub version, aside from possibly the authentication method. You could potentially use personal access tokens for git and npm feed authentication (similar to above), or other methods are available which aren't currently covered here.

If you're publishing to a private Azure Artifacts npm feed, be sure to set `registry` in the `beachball` config [as described above](#setting-options-for-publishing).
