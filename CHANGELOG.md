# Change Log - p-graph

<!-- This log was last generated on Thu, 19 Feb 2026 05:38:35 GMT and should not be manually modified. -->

<!-- Start content -->

## 1.3.0

Thu, 19 Feb 2026 05:38:35 GMT

### Minor changes

- Directly export the `PGraph` class, and add more docs.
- Rewrite the graph algorithms to be more efficient.
- Fix priority queue ordering bug.

## 1.2.0

Wed, 20 Aug 2025 03:56:20 GMT

### Minor changes

- Update repo-internal Node and TS versions to latest (previous Node compatibility should be maintained), and use type imports/exports where relevant (elcraig@microsoft.com)
- Add a named export for the `pGraph` function (elcraig@microsoft.com)

## 1.1.2

Tue, 26 Oct 2021 07:12:04 GMT

### Patches

- update cyclic dependancy error to inlude the cycle (cheruiyotbryan@gmail.com)

## 1.1.1

Tue, 13 Apr 2021 06:46:49 GMT

### Patches

- add descriptive error message when there is a cyclic dependancy (cheruiyotbryan@gmail.com)

## 1.1.0

Thu, 22 Oct 2020 19:44:39 GMT

### Minor changes

- adding a continue option to p-graph to allow graph to be traversed as far as possible (kchau@microsoft.com)

## 1.0.2

Mon, 05 Oct 2020 17:08:03 GMT

### Patches

- perf: Improve perf of graphHasCycles function (olwheele@microsoft.com)

## 1.0.1

Tue, 14 Jul 2020 21:39:50 GMT

### Patches

- Export types (1581488+christiango@users.noreply.github.com)

## 1.0.0

Tue, 14 Jul 2020 20:57:54 GMT

### Major changes

- Add support for maxConcurrency and allow for setting execution priorities on functions (1581488+christiango@users.noreply.github.com)

## 0.4.1

Mon, 25 May 2020 21:06:05 GMT

### Patches

- change the url of the p-graph (kchau@microsoft.com)

## 0.4.0

Tue, 05 May 2020 21:41:06 GMT

### Minor changes

- ripped out the dependency on p-queue (kchau@microsoft.com)

### Patches

- fix typings (kchau@microsoft.com)

## 0.3.4

Fri, 01 May 2020 20:41:56 GMT

### Patches

- process the args accurately (kchau@microsoft.com)

## 0.3.3

Fri, 01 May 2020 19:12:59 GMT

### Patches

- this lib is using esm default to publish, so it's a bit different in how to require (kchau@microsoft.com)

## 0.3.2

Fri, 01 May 2020 18:26:56 GMT

### Patches

- one more way of doing pGraph() call in types (kchau@microsoft.com)

## 0.3.1

Fri, 01 May 2020 18:25:27 GMT

### Patches

- one more way of doing pGraph() call in types (kchau@microsoft.com)

## 0.3.0

Fri, 01 May 2020 18:21:34 GMT

### Minor changes

- making public api work with 2 args with options (kchau@microsoft.com)

## 0.2.4

Fri, 01 May 2020 17:55:50 GMT

### Patches

- removed the section of readme that is known not to work (kchau@microsoft.com)

## 0.2.3

Fri, 01 May 2020 17:39:19 GMT

### Patches

- fixes the url (kchau@microsoft.com)

## 0.2.2

Fri, 01 May 2020 17:37:29 GMT

### Patches

- updates the readme.md and added a url to the package.json (kchau@microsoft.com)

## 0.2.1

Fri, 01 May 2020 16:30:46 GMT

### Patches

- added types (kchau@microsoft.com)

## 0.2.0

Fri, 01 May 2020 16:15:38 GMT

### Minor changes

- undefined (kchau@microsoft.com)
