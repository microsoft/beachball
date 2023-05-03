---
tags:
  - overview
category: doc
---

# CI Integration

For the repository and package owners who want to automate the bumping of versions based on change files with `beachball`, you'll need to provide some information for your Continuous Integration (CI) systems. These one-time setup steps will be unique for different CI system naturally, but the general idea remain the same. `beachball publish` needs write access to with are the git repo and npm registry.

## Git Authentication

There are several ways to authenticate against a git repository. Here's one way to do so with a personal token. Put this in your publishing build scripts:

```bash
git config user.email "someone@example.com"
git config user.name "someone"
git remote set-url origin https://$(user):$(pat)@github.com/someuser/someproject.git
```

> Note: never check in your credentials into a git repository! Simply use the "secret variable" feature to pass in the PAT here.

These commands will give the git user a name and email. Also, the last command will set a different URL for the git remote named "origin". If you have SSH key pairs setup, you would not need to run that last line in your scripts.

## NPM Authentication

To publish to a npm registry, you'll need to have access to the write-enabled access token. npm registry has [documentation](https://docs.npmjs.com/creating-and-viewing-authentication-tokens) on how to create automation tokens. Pass this token into the command line:

```
beachball publish -n SOME_AUTH_TOKEN
```

A common requirement is to be able to publish to a private registry other than npmjs.org. You can also customize the registry URL by passing in one additional parameter:

```
beachball publish -n SOME_AUTH_TOKEN -r http://SOME_REGISTRY_URL/
```

## package.json script

It's recommended to encapsulate any custom options in a `package.json` script:

> Note: When running Beachball in CI, add the `-y` flag (or `--yes`). That skips the intractive prompts that are commonly unavailable in CI consoles.

```json
{
  "scripts": {
    "publish:beachball": "beachball publish -y -n $(npm.token)"
  }
}
```

Then inside the CI script, simply call `yarn publish:beachball` or `npm run publish:beachball`.


## Examples

### With Azure DevOps

**1 Npm authentication**. Azure DevOps has a pre-built task `npmAuthenticate@0` to create a temporary npm auth token for publishing.

```yml
  - task: npmAuthenticate@0
    inputs:
      workingFile: .npmrc
```

**2 Git authentication**.

**2.1 Add env variables.** First, you need to add environment variables. One way to do it is through a _Variable group_. Find it in Library → “+ Variable group” → “+ Add”.

Add 4 env vars:
- git.pat
- git.user
- git.name
- git.email

Give your pipeline permissins to access these variables in _Pipeline permissions_.

**2.2 Configure Git.**

```yml
  - script: |
      git config user.email $(git.email)
      git config user.name $(git.name)
      git remote set-url origin https://$(git.user):$(git.pat)@github.com/someuser/someproject.git
    displayName: 'Configure git'
```

**3 Add publish script.** Final step is adding a publish script to `package.json` like e.g. `"beachball:publish": "beachball publish --yes"`. Note, that `npmAuthenticate@0` task is taking care of publishing access, so you do not need to pass an Npm token here.

Add a task to run the script in the pipeline.

```yml
  - script: |
      npm run beachball:publish
    displayName: 'Publishing'
```

**4 Final configuration.**

```yml
  - task: npmAuthenticate@0
    inputs:
      workingFile: .npmrc
  - script: |
      git config user.email $(git.email)
      git config user.name $(git.name)
      git remote set-url origin https://$(git.user):$(git.pat)@github.com/someuser/someproject.git
    displayName: 'Configure git'
  - script: |
      npm run beachball:publish
    displayName: 'Publishing'
```
