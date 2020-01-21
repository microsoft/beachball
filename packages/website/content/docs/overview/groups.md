---
title: 'Version Groups'
tags: groups, lock step
category: doc
---

By default, all packages in the repository are versioned based solely on the changes as specified by the change files. Developers are expected to create these change files along with the bump type for the packages as they go.

Some projects require bumping versions together so that the consumers really only need to remember one single version number when bumping related packages. The most famous of this strategy is Babel that versions all their related packages together with the locked step versioning.

`beachball` strives to be automated and flexible, so it provides a concept of version groups. Whenever one of the packages of one of the packages inside a group is bumped, the entire group's packages will get bumped the same way.

> Note: a package cannot belong to multiple groups - beachball will not allow its commands to work with that configuration

### Configuring groups

In the [configuration](./configuration) section, we discussed how to configure `beachball`. Here's an example of a config file named `beachball.config.js`:

```js
module.exports = {
  bumpDeps: true
}
```

We can add a group by adding it to the configuration like this:

```diff
module.exports = {
  bumpDeps: true
+ groups: [
+   {
+      name: "group name",
+      include: ["packages/groupfoo/*"],
+      exclude: ["packages/groupfoo/bar"]
+   }
+ ]
}
```

`beachball` uses `minimatch` to match which packages belong to which group via this configuration.
