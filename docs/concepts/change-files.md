---
tags: overview
category: doc
---

# Change Files

There are <a href="https://semantic-release.gitbook.io/semantic-release/" target="_blank">very popular</a> and excellent packages available which manage package versioning already. Beachball works differently: `beachball` does \_not\_ rely on commit messages for determining the next semantic version. Rather, it uses something called a "change file".

### What is a Change File?

After you have made some commits, you are ready to create a change file. A change file is generated for you by `beachball`. `beachball` uses the change file to determine how to bump versions in your package.

To generate a change file, you run this command:

```bash
$ beachball change # could leave out "change" command since it is the default
```

It will ask you to put in a description and a change type. Don't worry though, `beachball` is nice and will find recent commit messages if you would rather describe your changes based on something you already typed! The type of change you specify will influence how `beachball` will bump your version.

After you've answered those questions, a change file is created and commited in your branch under `/change` that looks like this:

```json
{
  "comment": "Upgrading React to 16.8.x to use hooks",
  "type": "minor",
  "packageName": "my-amazing-app",
  "email": "me@me.me",
  "commit": "b785112c03f063b71d936ff052470817019267d4",
  "date": "2019-06-20T22:54:59.172Z"
}
```

If you have some existing change file for this package, `beachball` will assume you're still working on the same feature and will skip the dialog.

### Working with the change file

`beachball` uses change files to indicate change type for a very good reason. File diffs work wonderfully well in all PR systems. These tools are well suited to visualize file diffs and allows a chance for reviewers to review what is written in a change file.

For example, a reviewer might remind the author that a certain new API has been introduced and that the change ought to be a minor. The author can then modify the change file without having to ammend history of a commit!
