/**
 * A description of a node in p-graph
 */
export interface PGraphNode {
  /**
   * The function that will be executed for this graph node.
   *
   * This is optional when creating the graph in case a shared runner function is passed
   * to `PGraph.run`.
   */
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  run?: () => unknown | Promise<unknown>;

  /**
   * A priority to help the scheduler decide which tasks to pick when many are available to run.
   * @default 0
   */
  priority?: number;
}

/**
 * Mapping from node ID to function and priority.
 * The function is optional in case a shared runner function is passed to `PGraph.run`.
 */
export type PGraphNodeMap = Map<string, PGraphNode>;

/**
 * Mapping from node ID to function and priority.
 * The function is optional in case a shared runner function is passed to `PGraph.run`.
 */
export type PGraphNodeRecord = Record<string, PGraphNode>;

/**
 * Each tuple describes a dependency between two nodes in the p-graph:
 * the first task must complete before the second one begins.
 */
export type DependencyList = [string, string][];

/**
 * The optional arguments to pass to the run function
 */
export interface RunOptions {
  /**
   * Instead of providing a `run` function for each node, you can optionally provide a single
   * runner function here which receives the node ID. This is useful for reusing the same
   * `PGraph` initialization to run different functions.
   *
   * If provided, this overrides the `run()` function provided with any individual node.
   */
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  run?: (nodeId: string) => unknown | Promise<unknown>;

  /**
   * The maximum number of promises that can be executing at the same time.
   * When not provided, we do not limit the number of concurrent tasks and run tasks
   * as soon as they are unblocked.
   */
  concurrency?: number;

  /**
   * If true, continue running the graph even if a task fails. Tasks dependent on the failed task
   * will be skipped, and a `PGraphError` containing all original errors will be thrown at the end.
   */
  continue?: boolean;
}

/**
 * An internally used representation of the dependency graph nodes that includes all nodes that
 * this node depends on plus all the nodes that depend on this node.
 */
export interface PGraphNodeWithDependencies extends PGraphNode {
  /**
   * The set of nodes that this node depends on. This node should not be executed until all the
   * nodes in this list have been executed to completion.
   */
  dependsOn: Set<string>;

  /**
   * The set of nodes that cannot start execution until this node has completed execution.
   */
  dependedOnBy: Set<string>;

  /**
   * Flag whether this node is failed or not (if so, skip it and mark its children to be skipped)
   */
  failed: boolean;
}
