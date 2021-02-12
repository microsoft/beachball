---
tags: overview
category: doc
---

# Installation

There are two options to install `beachball`.

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
