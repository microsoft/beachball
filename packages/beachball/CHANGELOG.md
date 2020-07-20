# Change Log - beachball

This log was last generated on Mon, 20 Jul 2020 20:54:36 GMT and should not be manually modified.

<!-- Start content -->

## 1.32.2

Mon, 20 Jul 2020 20:54:36 GMT

### Patches

- adds a retry to git push (kchau@microsoft.com)

## 1.32.1

Mon, 20 Jul 2020 19:32:41 GMT

### Patches

- refactored to allow sync to fix dependent ranges as well (kchau@microsoft.com)

## 1.32.0

Thu, 25 Jun 2020 16:07:16 GMT

### Minor changes

- Allow Individual Packages to Opt Out of Git Tags (ngerlem@microsoft.com)

## 1.31.4

Fri, 12 Jun 2020 15:55:32 GMT

### Patches

- Change the fetch to be scoped to the branch needed to do the diffing not the entire remote (kchau@microsoft.com)

## 1.31.3

Wed, 03 Jun 2020 20:35:49 GMT

### Patches

- add gitTags option to control git created tags (ahkotb@microsoft.com)

## 1.31.2

Wed, 03 Jun 2020 17:06:31 GMT

### Patches

- publish: log errors for each retry attempt (elcraig@microsoft.com)

## 1.31.1

Thu, 21 May 2020 23:56:52 GMT

### Patches

- validate the disallowedChangeTypes for publishing (kchau@microsoft.com)

## 1.31.0

Thu, 30 Apr 2020 19:33:20 GMT

### Minor changes

- checks for invalid beachball change file on check and all operations (kchau@microsoft.com)

## 1.30.2

Tue, 21 Apr 2020 00:12:02 GMT

### Patches

- Formatting cleanup; use fs-extra everywhere (elcraig@microsoft.com)

## 1.30.1

Mon, 20 Apr 2020 19:30:21 GMT

### Patches

- Fix multi-package publishing regression (#327). (reli@microsoft.com)

## 1.30.0

Sat, 18 Apr 2020 00:23:31 GMT

### Minor changes

- update prepublish hook to work on files rather than bumpInfo (jasonmo@microsoft.com)

## 1.29.4

Fri, 17 Apr 2020 22:32:59 GMT

### Patches

- Publish packages in the right order based on their dependency graph (xgao@microsoft.com)

## 1.29.3

Fri, 17 Apr 2020 22:15:02 GMT

### Patches

- validate private package not being a dependency (xgao@microsoft.com)

## 1.29.2

Fri, 17 Apr 2020 22:11:50 GMT

### Patches

- reduce npm publish log by set loglevel to warn (xgao@microsoft.com)

## 1.29.1

Thu, 16 Apr 2020 02:44:52 GMT

### Patches

- 10x spawnSync max buffer (xgao@microsoft.com)

## 1.29.0

Wed, 15 Apr 2020 23:41:45 GMT

### Minor changes

- adding a hooks option for prepublish foolery (kchau@microsoft.com)

## 1.28.3

Wed, 15 Apr 2020 23:24:07 GMT

### Patches

- Sync: honor scope and avoid private package (xgao@microsoft.com)

## 1.28.2

Mon, 13 Apr 2020 22:25:28 GMT

### Patches

- Making beachball getPackageInfos scale much better with a different git command (kchau@microsoft.com)

## 1.28.1

Wed, 08 Apr 2020 23:42:38 GMT

### Patches

- Fix a bug with inferring the commit hash (elcraig@microsoft.com)

## 1.28.0

Mon, 06 Apr 2020 21:44:28 GMT

### Minor changes

- Export more types (elcraig@microsoft.com)

## 1.27.0

Fri, 03 Apr 2020 15:58:44 GMT

### Minor changes

- Export public-facing types from root (elcraig@microsoft.com)

## 1.26.0

Fri, 03 Apr 2020 00:56:37 GMT

### Minor changes

- Add custom render functions for changelog parts (elcraig@microsoft.com)

## 1.25.2
Tue, 31 Mar 2020 18:55:18 GMT

### Patches

- update isValidChangeType to allow none (xgao@microsoft.com)
## 1.25.1
Tue, 31 Mar 2020 18:52:13 GMT

### Patches

- adding a sync command to help recover (kchau@microsoft.com)
## 1.25.0
Mon, 30 Mar 2020 20:58:37 GMT

### Minor changes

- Change file prompt: support customizing prompt questions (xgao@microsoft.com)
## 1.24.0
Mon, 30 Mar 2020 20:34:38 GMT

### Minor changes

- adding a retries option (kchau@microsoft.com)
## 1.23.3
Fri, 27 Mar 2020 23:29:23 GMT

### Patches

- Add readme to beachball package (elcraig@microsoft.com)
## 1.23.2
Fri, 27 Mar 2020 19:03:31 GMT

### Patches

- Improve manual recovery message if some packages succeeded; increase maxBuffer for publish (elcraig@microsoft.com)
## 1.23.1
Wed, 25 Mar 2020 20:20:02 GMT

### Patches

- Change lodash from a devDepedency to a dependency (jdh@microsoft.com)
## 1.23.0
Wed, 25 Mar 2020 19:43:44 GMT

### Minor changes

- ChangeLog: support grouped change log generation (xgao@microsoft.com)
## 1.22.0
Mon, 23 Mar 2020 21:24:15 GMT

### Minor changes

- ChangeLog: add empty options interface (xgao@microsoft.com)
## 1.21.0
Mon, 23 Mar 2020 19:20:05 GMT

### Minor changes

- Delay inferring commit hash until changelog generation (and remove commit from changefiles) (elcraig@microsoft.com)
## 1.20.4
Fri, 20 Mar 2020 23:50:38 GMT

### Patches

- Fix version group bumping logic (xgao@microsoft.com)
## 1.20.3
Fri, 20 Mar 2020 20:37:09 GMT

### Patches

- Fix promptChangeFiles to honor disallowedChangeTypes defined in version groups (xgao@microsoft.com)
## 1.20.2
Sat, 07 Mar 2020 00:06:17 GMT

### Patches

- Scoped publish: make sure toskip validation/publish for out-of-scope package (xgao@microsoft.com)
## 1.20.1
Thu, 05 Mar 2020 17:01:38 GMT

### Patches

- adding some bumpminrange test and add support for * as range (kchau@microsoft.com)
## 1.20.0
Wed, 04 Mar 2020 02:47:34 GMT

### Minor changes

- Feature: scoped publish (xgao@microsoft.com)
## 1.19.0
Wed, 04 Mar 2020 00:13:30 GMT

### Minor changes

- Adds a new feature to do scoping of checks and change (kchau@microsoft.com)
## 1.18.4
Fri, 17 Jan 2020 18:13:36 GMT

### Patches

- fixing a bug about infinite loop in allowed type (kchau@microsoft.com)
## 1.18.3
Thu, 16 Jan 2020 20:27:41 GMT

### Patches

- update depedent package bump logic to propagate the change types (kchau@microsoft.com)
## 1.18.2
Thu, 16 Jan 2020 04:52:54 GMT

### Patches

- adding some unit tests for bump low level logic as well as adding ability to have change files dictate what change type to use for dependent bumps (kchau@microsoft.com)
## 1.18.1
Wed, 15 Jan 2020 04:54:51 GMT

### Patches

- Fixes tagging and also publish brand new packages if not exists (kchau@microsoft.com)
## 1.18.0
Wed, 15 Jan 2020 03:17:45 GMT

### Minor changes

- adding ability to have config files (kchau@microsoft.com)
- refactored to get ready to support version groups (kchau@microsoft.com)
- Adds a new feature of version groups that would allow "locked versions" updates (kchau@microsoft.com)
### Patches

- Improve package list formatting (elcraig@microsoft.com)
- fixed a bug in getting the command right in the cli (kchau@microsoft.com)
## 1.16.0
Thu, 05 Dec 2019 00:40:40 GMT

### Minor changes

- Bump peerDependencies (rezha@microsoft.com)
## 1.15.1
Fri, 15 Nov 2019 20:01:55 GMT

### Patches

- catch eerrors throw and make sure we exit with a real status code (kchau@microsoft.com)
## 1.15.0
Wed, 13 Nov 2019 23:31:43 GMT

### Minor changes

- Add --bump-deps flag to bump all dependent packages (rezha@microsoft.com)
## 1.14.3
Mon, 04 Nov 2019 23:56:08 GMT

### Patches

- deletes none type change files (kchau@microsoft.com)
## 1.14.2
Wed, 23 Oct 2019 17:32:05 GMT

### Patches

- make sure that we don't have file names in change files (kchau@microsoft.com)
## 1.14.1
Fri, 04 Oct 2019 15:11:40 GMT

### Patches

- fixed package publishing for private packages (kchau@microsoft.com)
## 1.14.0
Fri, 04 Oct 2019 00:52:18 GMT

### Minor changes

- Adding robustness in how publish works so merging is safer (odbuild@microsoft.com)
## 1.13.5
Fri, 27 Sep 2019 23:42:49 GMT

### Patches

- adds publish test for git push as well as refactoring publish to be more readable (odbuild@microsoft.com)
## 1.13.4
Wed, 25 Sep 2019 21:40:51 GMT

### Patches

- Add option to specify a defaultNpmTag on a per package basis (acoates@microsoft.com)
## 1.13.3
Wed, 25 Sep 2019 20:49:49 GMT

### Patches

- make tests work on windows (kchau@microsoft.com)
## 1.13.2
Mon, 16 Sep 2019 22:57:40 GMT

### Patches

- adding fetching for specific remote instead of all (kchau@microsoft.com)
## 1.13.1
Tue, 10 Sep 2019 19:37:18 GMT

### Patches

- Fixing packageJsonPath to contain full path (kchau@microsoft.com)
## 1.13.0
Tue, 03 Sep 2019 19:59:44 GMT

### Minor changes

- allow staged files to be counted for changes as well (kchau@microsoft.com)
## 1.12.2
Tue, 27 Aug 2019 17:44:33 GMT

### Patches

- make sure to bump the deps of monorepo packages of other packages even if the packages are private (kchau@microsoft.com)
## 1.12.1
Tue, 27 Aug 2019 03:11:47 GMT

### Patches

- making publish skip when there is no changes (kchau@microsoft.com)
## 1.12.0
Fri, 23 Aug 2019 16:30:54 GMT

### Minor changes

- ignores changelogs (kchau@microsoft.com)
## 1.11.9
Fri, 23 Aug 2019 03:52:35 GMT

### Patches

- fixing changelog formatting (kchau@microsoft.com)
## 1.11.8
Thu, 22 Aug 2019 18:17:34 GMT

### Patches

- Integration tests with real on-disk repositories. (jdh@microsoft.com)
- modify logic to not run on private packages (legray@microsoft.com)

## 1.11.7
Tue, 20 Aug 2019 15:18:38 GMT

### Patches

- fixes the issue with change command not generating change files due to the master having their change files deleted by publishing (kchau@microsoft.com)

## 1.11.6
Wed, 07 Aug 2019 00:23:45 GMT

### Patches

- adds a fetch before diff changes, more info from when change files are needed (kchau@microsoft.com)

## 1.11.5
Sat, 03 Aug 2019 04:05:33 GMT

### Patches

- change format of the error message a tiny bit (kchau@microsoft.com)

## 1.11.4
Sat, 03 Aug 2019 03:59:51 GMT

### Patches

- make the mergepublish portion spit out more explicit messages (kchau@microsoft.com)

## 1.11.3
Sat, 03 Aug 2019 03:11:15 GMT

### Patches

- adds some comment about git fail fast and when to use it (kchau@microsoft.com)

## 1.11.2
Sat, 03 Aug 2019 03:08:37 GMT

### Patches

- Beachball publish should error if git commands fail (acoates@microsoft.com)

## 1.11.1
Wed, 31 Jul 2019 22:00:03 GMT

### Patches

- default branch name should be master (kchau@microsoft.com)

## 1.11.0
Fri, 26 Jul 2019 18:00:02 GMT

### Minor changes

- Fixes #64, #65, #62, #2 - usability changes (kchau@microsoft.com)

## 1.10.3
Fri, 26 Jul 2019 04:30:54 GMT

### Patches

- make git tags to be pushed (kchau@microsoft.com)

## 1.10.2
Tue, 23 Jul 2019 21:27:22 GMT

### Patches

- making beachball node 8 compatible (kchau@microsoft.com)

## 1.10.1
Thu, 18 Jul 2019 20:18:23 GMT

### Patches

- Fix shouldPublish option (acoates@microsoft.com)

## 1.10.0
Thu, 18 Jul 2019 18:39:14 GMT

### Minor changes

- Add prerelease option (kchau@microsoft.com)

## 1.9.2
Tue, 02 Jul 2019 16:05:08 GMT

### Patches

- do not put none changes inside changelog.md (kchau@microsoft.com)

## 1.9.1
Tue, 02 Jul 2019 15:41:45 GMT

### Patches

- makes the bump skip unknown packages (kchau@microsoft.com)

## 1.9.0
Fri, 28 Jun 2019 17:53:25 GMT

### Minor changes

- adds support for tags in CHANGELOG.json (kchau@microsoft.com)

## 1.8.2
Thu, 27 Jun 2019 21:23:00 GMT

### Patches

- matching changelog.json format to rush's formatting (kchau@microsoft.com)

## 1.8.1
Thu, 27 Jun 2019 21:10:15 GMT

### Patches

- use object.values (kchau@microsoft.com)

## 1.8.0
Thu, 27 Jun 2019 17:50:36 GMT

### Minor

- Also writes out json for changelogs while fixing the sitemap (kchau@microsoft.com)

## 1.7.0
Sun, 23 Jun 2019 00:40:35 GMT

### Minor

- adding smarts about which change files are already in master (kchau@microsoft.com)

## 1.6.4
Tue, 18 Jun 2019 06:30:58 GMT

### Patches

- making the default registry have a trailing slash to publish with token correctly (kchau@microsoft.com)

## 1.6.3
Tue, 18 Jun 2019 05:58:35 GMT

### Patches

- enable token argument (kchau@microsoft.com)

## 1.6.2
Tue, 18 Jun 2019 05:44:02 GMT

### Patches

- use a specific registry and also displaynpm publish command (kchau@microsoft.com)

## 1.6.1
Tue, 18 Jun 2019 05:27:14 GMT

### Patches

- display publish errors (kchau@microsoft.com)

## 1.6.0
Tue, 18 Jun 2019 05:13:35 GMT

### Minor

- -b now takes remote branch full name (kchau@microsoft.com)

## 1.5.1
Mon, 17 Jun 2019 17:36:58 GMT

### Patches

- Be more specific in publish to disambiguate the tag and target branch (kchau@microsoft.com)

## 1.5.0
Fri, 14 Jun 2019 19:35:56 GMT

### Minor

- find the right fork point (kchau@microsoft.com)

## 1.4.0
Wed, 12 Jun 2019 01:53:04 GMT

### Minor

- adds no-publish and no-push, skips bump of none (kchau@microsoft.com)

## 1.3.1
Tue, 11 Jun 2019 19:34:32 GMT

### Patches

- fail on change files (kchau@microsoft.com)

## 1.3.0
Tue, 11 Jun 2019 17:49:00 GMT

### Minor

- adds support for auth token (kchau@microsoft.com)

## 1.2.0
Mon, 10 Jun 2019 23:53:27 GMT

### Minor

- adding docs and publishes safe guards (kchau@microsoft.com)

## 1.1.0
Mon, 10 Jun 2019 21:29:49 GMT

### Minor

- First real release (kchau@microsoft.com)
