# install-beachball

Globally installs the version of Beachball specified in the repo root `package.json`'s `devDependencies`.

This is intended for running a change files check in a separate workflow where you don't need to do a full `yarn`/`npm install`.

## Getting started

To run this action:

```yaml
jobs:
  build:
    steps:
      # You must check out code before using this action
      - uses: actions/checkout@v6

      - uses: microsoft/beachball/actions/install-beachball@v3
```
