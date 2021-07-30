# Change Log - beachball

This log was last generated on Fri, 30 Jul 2021 21:04:39 GMT and should not be manually modified.

<!-- Start content -->

## 2.10.2

Fri, 30 Jul 2021 21:04:39 GMT

### Patches

- fixes canary not to use latest tag for npm (kchau@microsoft.com)

## 2.10.1

Fri, 30 Jul 2021 07:14:51 GMT

### Patches

- Another attempt at ignoring test files (elcraig@microsoft.com)

## 2.10.0

Fri, 30 Jul 2021 07:00:05 GMT

### Minor changes

- Remove `group` from `PackageInfo`, and calculate as needed instead of setting it as a side effect (elcraig@microsoft.com)

### Patches

- Stop publishing test and config files (elcraig@microsoft.com)
- Reduce number of times `getPackageInfos` is called (elcraig@microsoft.com)

## 2.9.1

Wed, 28 Jul 2021 21:59:24 GMT

### Patches

- Stop publishing docs and configs in npm package (elcraig@microsoft.com)

## 2.9.0

Wed, 28 Jul 2021 21:55:21 GMT

### Minor changes

- Update typescript to 3.9 (elcraig@microsoft.com)

## 2.8.1

Fri, 23 Jul 2021 00:04:33 GMT

### Patches

- Add fallback logic for publishConfig values (scott.schmalz@gmail.com)

## 2.8.0

Thu, 22 Jul 2021 23:33:10 GMT

### Minor changes

- Fix for handling of custom schema while updating the CHANGELOG.json file (pravcha@microsoft.com)

## 2.7.0

Thu, 22 Jul 2021 22:09:07 GMT

### Minor changes

- Adding option to specify custom changelog at the package level (pravcha@microsoft.com)

## 2.6.3

Fri, 16 Jul 2021 18:14:39 GMT

### Patches

- Fixes changelogs comment count to be overridden by dependent bumps (kchau@microsoft.com)

## 2.6.2

Tue, 22 Jun 2021 20:45:00 GMT

### Patches

- Fixes a perf regression due to a change in getting remote default branch (kchau@microsoft.com)

## 2.6.1

Thu, 03 Jun 2021 20:30:47 GMT

### Patches

- actually query for the default branch rather than assuming master (kchau@microsoft.com)

## 2.6.0

Thu, 03 Jun 2021 19:08:26 GMT

### Minor changes

- Beachball check is going to be much faster (kchau@microsoft.com)

## 2.5.1

Fri, 28 May 2021 02:09:13 GMT

### Patches

- Improve tests to be robust angainst global setting for default branch (dannyvv@microsoft.com)

## 2.5.0

Thu, 27 May 2021 22:24:48 GMT

### Minor changes

- Add validation for the dependentChangeType field in changefiles (nickykalu@microsoft.com)

### Patches

- bump workspace-tools (kchau@microsoft.com)

## 2.4.1

Thu, 27 May 2021 22:23:24 GMT

### Patches

- bump workspace-tools (kchau@microsoft.com)

## 2.4.0

Thu, 20 May 2021 22:47:45 GMT

### Minor changes

- Add npm basic auth capability via new authType argument. (jagore@microsoft.com)

## 2.3.0

Fri, 07 May 2021 15:12:45 GMT

### Minor changes

- Only commit changefiles and ignore other staged files on 'beachball change command' (nickykalu@microsoft.com)

## 2.2.0

Wed, 14 Apr 2021 15:34:23 GMT

### Minor changes

- feat: Bump workspace-tools (asgramme@microsoft.com)

## 2.1.0

Fri, 02 Apr 2021 17:49:52 GMT

### Minor changes

- adds a feature of adding publish-config, bumps requirement to node 12 (kchau@microsoft.com)

## 2.0.0

Fri, 02 Apr 2021 17:34:25 GMT

### Major changes

- BREAKING: Adding a requirement of node engine 12+

## 1.53.2

Tue, 23 Mar 2021 17:35:03 GMT

### Patches

- Update canary command to respect --no-publish flag (mail@jamesburnside.com)

## 1.53.1

Thu, 04 Mar 2021 18:56:14 GMT

### Patches

- Fix detection of default remote branch when it's not specified at CLI (elcraig@microsoft.com)

## 1.53.0

Tue, 23 Feb 2021 20:40:17 GMT

### Minor changes

- adds a --all canary option (kchau@microsoft.com)

## 1.52.0

Thu, 18 Feb 2021 22:45:51 GMT

### Minor changes

- adding an init command (kchau@microsoft.com)

## 1.51.2

Thu, 18 Feb 2021 21:54:39 GMT

### Patches

- more workspace-tools integration: getPackageInfos (kchau@microsoft.com)

## 1.51.1

Wed, 17 Feb 2021 00:12:20 GMT

### Patches

- replacing the git util from beachball with the workspace-tools one (kchau@microsoft.com)

## 1.51.0

Tue, 16 Feb 2021 16:43:02 GMT

### Minor changes

- Add postpublish hook (mmaclachlan@ccri.com)

## 1.50.1

Thu, 04 Feb 2021 18:56:24 GMT

### Patches

- check: Add validation of published package deps (elcraig@microsoft.com)

## 1.50.0

Fri, 22 Jan 2021 23:56:47 GMT

### Minor changes

- Allow passing --config to specify config file (ngerlem@microsoft.com)

## 1.49.0

Tue, 12 Jan 2021 20:28:35 GMT

### Minor changes

- Roll-up the changelogs to dependents (arabisho@microsoft.com)

## 1.48.3

Mon, 11 Jan 2021 10:30:42 GMT

### Patches

- Prevent prompt from overriding the message passed by CLI args (arabisho@microsoft.com)

## 1.48.2

Tue, 05 Jan 2021 05:46:59 GMT

### Patches

- Add support for multiple project roots within a repo (bewegger@microsoft.com)

## 1.48.1

Fri, 18 Dec 2020 18:31:08 GMT

### Patches

- Use merge base for comparing two refs (arabisho@microsoft.com)

## 1.48.0

Mon, 14 Dec 2020 21:08:05 GMT

### Minor changes

- Adding a new option that allows to specify a pre-release prefix (arabisho@microsoft.com)

## 1.47.1

Thu, 10 Dec 2020 21:14:31 GMT

### Patches

- Cap the output from git to avoid process crashing with enobufs (arabisho@microsoft.com)

## 1.47.0

Tue, 08 Dec 2020 19:53:12 GMT

### Minor changes

- Implement the 'disallow-deleted-change-files' flag (arabisho@microsoft.com)

## 1.46.0

Tue, 08 Dec 2020 18:55:00 GMT

### Minor changes

- Expose dependent-change-type as CLI argument (arabisho@microsoft.com)

## 1.45.1

Tue, 08 Dec 2020 18:18:13 GMT

### Patches

- Set disallowedChangeTypes property only if arg is present (arabisho@microsoft.com)

## 1.45.0

Tue, 01 Dec 2020 23:16:33 GMT

### Minor changes

- Expose 'disallowed-change-types' as a CLI option (arabisho@microsoft.com)

## 1.44.0

Mon, 30 Nov 2020 18:16:10 GMT

### Minor changes

- Bump yargs version (1581488+christiango@users.noreply.github.com)

## 1.43.1

Fri, 20 Nov 2020 18:46:16 GMT

### Patches

- Respect --token argument in the sync command (arabisho@microsoft.com)

## 1.43.0

Fri, 20 Nov 2020 18:02:40 GMT

### Minor changes

- Allow branch name to fall back to config file. Fixes #377 (jdh@microsoft.com)

## 1.42.0

Wed, 28 Oct 2020 21:21:29 GMT

### Minor changes

- Implements the --force flag for sync (arabisho@microsoft.com)

### Patches

- Fix syncE2E tests (arabisho@microsoft.com)

## 1.41.0

Wed, 28 Oct 2020 20:58:56 GMT

### Minor changes

- Replace timestamps with uuids in change file names (arabisho@microsoft.com)

## 1.40.0

Wed, 28 Oct 2020 20:56:33 GMT

### Minor changes

- Remove timestamp from change files (arabisho@microsoft.com)

## 1.39.1

Thu, 22 Oct 2020 00:00:35 GMT

### Patches

- Fix package level tag option. (xgao@microsoft.com)

## 1.39.0

Wed, 21 Oct 2020 18:27:09 GMT

### Minor changes

- For out-of-scope package, do not update its dependencies versions along with its own version. (xgao@microsoft.com)

## 1.38.0

Mon, 19 Oct 2020 16:43:47 GMT

### Minor changes

- Update sync command to respect the --tag value (arabisho@microsoft.com)

## 1.37.0

Wed, 07 Oct 2020 23:22:24 GMT

### Minor changes

- bumps very specific deps, don't go overboard with spreading (kchau@microsoft.com)

## 1.36.2

Mon, 28 Sep 2020 21:12:06 GMT

### Patches

- avoid bump loop by being more selective about what gets bumped (kchau@microsoft.com)

## 1.36.1

Tue, 22 Sep 2020 02:55:40 GMT

### Patches

- be targeted in the fetch (kchau@microsoft.com)

## 1.36.0

Fri, 11 Sep 2020 23:57:23 GMT

### Minor changes

- Adds the ability to create and publish canary packages (kchau@microsoft.com)

## 1.35.6

Fri, 11 Sep 2020 22:07:20 GMT

### Patches

- making a distinction between packageOptions and combinedOptions (kchau@microsoft.com)

## 1.35.5

Fri, 04 Sep 2020 21:04:07 GMT

### Patches

- handles detached head when publishing (kchau@microsoft.com)

## 1.35.4

Fri, 28 Aug 2020 21:28:56 GMT

### Patches

- add testing and fixes to retries for pushes (kchau@microsoft.com)

## 1.35.3

Sun, 23 Aug 2020 01:36:24 GMT

### Patches

- Fix broken "beachball change" (#386). (reli@microsoft.com)

## 1.35.2

Fri, 21 Aug 2020 16:14:19 GMT

### Patches

- do not fetch before npm publish (kchau@microsoft.com)

## 1.35.1

Mon, 17 Aug 2020 23:07:36 GMT

### Patches

- making sync actually just ask for latest dist-tag (kchau@microsoft.com)

## 1.35.0

Thu, 06 Aug 2020 19:31:46 GMT

### Minor changes

- --no-bump flag implementation (arabisho@microsoft.com)

## 1.34.0

Wed, 05 Aug 2020 20:06:03 GMT

### Minor changes

- Implements the `--keep-change-files` flag to prevent change files from being deleted by bump and publish commands (arabisho@microsoft.com)

## 1.33.0

Wed, 05 Aug 2020 19:12:35 GMT

### Minor changes

- The `--since` flag implementation is added for filtering change files using git refs. (arabisho@microsoft.com)

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
