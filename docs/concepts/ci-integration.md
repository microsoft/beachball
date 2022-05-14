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

**1 Npm authentication**. Azure DevOps has `npmAuthenticate@0` available to create a temporary npm auth token for publishing.

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

**2.1 Configure Git.** You can set up your Azure DevOps pipeline to add git credentials with Git CLI or you can extrapolate it in a Node script like this:

```js
const shell = require('shelljs');
const { logger } = require('just-scripts');

shell.set('-e');

module.exports = function gitAuth() {
  logger.info('Authenticating Git');
  shell.exec(`git config user.email "${process.env.GIT_EMAIL}"`);
  shell.exec(`git config user.name "${process.env.GIT_NAME}"`);
  shell.exec(
    `git remote set-url origin https://${process.env.GIT_USER}:${process.env.GIT_PAT}@github.com/someuser/someproject.git`,
  );
};
```

**2.2 Add Npm script.** Add your script to `package.json`, e.g. `"git-auth": "node ./scripts/git-auth.js"`.

**2.3 Add task.** Add a task to configure Git.

```yml
  - script: |
      npm run git-auth
    displayName: 'Configure git'
    env:
      GIT_PAT: $(git.pat)
      GIT_USER: $(git.user)
      GIT_NAME: $(git.name)
      GIT_EMAIL: $(git.email)
```

**3 Add publish script** Final step is adding a publish script to `package.json` like e.g. `"beachball:publish": "beachball publish --yes"`. Note, that `npmAuthenticate@0` task is taking care of publishing access, so you do not need to pass an Npm token here.

Add a task to run the script in the pipeline.

```yml
  - script: |
      npm run beachball:publish
    displayName: 'Publishing'
```

**4 Final configuration**

```yml
  - task: npmAuthenticate@0
    inputs:
      workingFile: .npmrc
  - script: |
      npm run git-auth
    displayName: 'Configure git'
    env:
      GIT_PAT: $(git.pat)
      GIT_USER: $(git.user)
      GIT_NAME: $(git.name)
      GIT_EMAIL: $(git.email)
  - script: |
      npm run beachball:publish
    displayName: 'Publishing'
```
