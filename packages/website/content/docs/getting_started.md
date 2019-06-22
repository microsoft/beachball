---
title: 'Getting Started'
tags: overview
category: doc
---

Javascript ecosystem moves fast. It moves so fast that sometimes the tools need to catch up to it. One of the reasons that this particular ecosystem is so vibrant and agile is in its ability to share code via npm packages. This has led to an explosion of versions of packages in the npm registries. These days, we have public and private registries. Developers also have to keep their git repos sync'ed up with the npm registry versions... what a hassle!

## But Enough Talk, Have At You!

There are two options to get started with `beachball`.

### Option 1: no install

Thanks to `npx`, you can use `beachball` without any installation:

```bash
npx beachball --help
```

### Option 2: Install and Run as NPM Scripts

To get started, place this in the `devDependencies` section of your `package.json`:

```bash
npm install -D beachball
```

or for yarn users:

```bash
yarn add -D beachball
```

After that, add some scripts to call `beachball` commands:

```json
{
  "scripts": {
    "change": "beachball change",
    "check": "beachball check",
    "beachball:publish": "beachball publish"
  }
}
```
