// @ts-check
// Disable caching in workspace-tools to prevent interference with tests that reuse directories
// with potentially different contents.
require('workspace-tools').setCachingEnabled(false);

// Disable caching in beachball
process.env.BEACHBALL_DISABLE_CACHE = '1';
