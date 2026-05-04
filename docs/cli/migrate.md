---
tags:
  - cli
category: doc
---

# `migrate`

Checks your beachball config for any updates needed to migrate from v2 to v3, and logs them to the console.

```bash
beachball migrate
```

If your config is already compatible with v3, you will see:

```
No config updates are needed for v3.
```

Otherwise, the command will list specific updates that need to be made.

See the [v3 migration guide](../overview/v3-migration) for more information.
