const isAzurePipelines = !!process.env.TF_BUILD;
const isJest = !!process.env.JEST_WORKER_ID;

export const env = Object.freeze({
  // most everything but ADO sets process.env.CI by default
  isCI: !!process.env.CI || isAzurePipelines,

  isJest,

  /**
   * @deprecated This should likely be replaced with a different strategy (it's never set)
   * but actually disabling all the caching e.g. whenever running in jest would cause major
   * test perf issues due to various methods being called too many times. Leaving it for now
   * because it makes it easy to find the places that are doing cachine.
   */
  beachballDisableCache: !!process.env.BEACHBALL_DISABLE_CACHE,

  // These are borrowed from workspace-tools
  workspaceToolsGitDebug: !!process.env.GIT_DEBUG,
  workspaceToolsGitMaxBuffer: (process.env.GIT_MAX_BUFFER && parseInt(process.env.GIT_MAX_BUFFER, 10)) || undefined,
  /** @deprecated Use `options.npmReadConcurrency` */
  // if this is removed, default logic should go to getDefaultOptions
  npmConcurrency: (process.env.NPM_CONCURRENCY && parseInt(process.env.NPM_CONCURRENCY)) || (isJest ? 2 : 5),
});
