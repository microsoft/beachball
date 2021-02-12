---
tags: overview
category: doc
---

# CI Integration

For the repository and package owners who want to automate the bumping of versions based on change files with `beachball`, you'll need to provide some information for your Continuous Integration (CI) systems. These one-time setup steps will be unique for different CI system naturally, but the general idea remain the same. `beachball publish` needs write access to with are the git repo and npm registry.

### Git Authentication

There are several ways to authenticate against a git repository. Here's one way to do so with a personal token. Put this in your publishing build scripts:

```bash
git config user.email "someone@example.com"
git config user.name "someone"
git remote set-url origin https://$(user):$(pat)@github.com/someuser/someproject.git
```

> Note: never check in your credentials into a git repository! Simply use the "secret variable" feature to pass in the PAT here.

These commands will give the git user a name and email. Also, the last command will set a different URL for the git remote named "origin". If you have SSH key pairs setup, you would not need to run that last line in your scripts.

### NPM Authentication

To publish to a npm registry, you'll need to have access to the write-enabled access token. npm registry has [documentation](https://docs.npmjs.com/creating-and-viewing-authentication-tokens) on how to create write tokens. Pass this token into the command line:

```
beachball publish -n SOME_AUTH_TOKEN
```

A common requirement is to be able to publish to a private registry other than npmjs.org. You can also customize the registry URL by passing in one additional parameter:

```
beachball publish -n SOME_AUTH_TOKEN -r http://SOME_REGISTRY_URL/
```

### package.json script

It's recommended to encapsulate any custom options in a `package.json` script:

```json
{
  "scripts": {
    "publish:beachball": "beachball publish -n $(npm.token)"
  }
}
```

Then inside the CI script, simply call `yarn publish:beachball` or `npm run publish:beachball`.
