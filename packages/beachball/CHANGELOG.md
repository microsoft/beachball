# Change Log - beachball

This log was last generated on Fri, 04 Oct 2019 15:11:40 GMT and should not be manually modified.

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
