# Beachball doc site

This site is built with Vuepress v2. It uses a separate yarn installation--this was originally done to get rid of very outdated deps while keeping beachball v2 on Node 14, but even with beachball updated, it's still somewhat helpful to separate the installations to easily see which deps and security alerts are doc-only.

The current documentation is published at the site root. The `v2` directory is a frozen snapshot of the beachball v2 documentation, published under `/v2/`. Corrections to the v2 documentation must be deliberately ported into this directory rather than synchronized automatically from the `v2` branch.
