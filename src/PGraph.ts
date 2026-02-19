import type {
  RunOptions,
  PGraphNodeMap,
  DependencyList,
  PGraphNodeWithDependencies,
  PGraphNodeRecord,
} from "./types";
import { PriorityQueue } from "./PriorityQueue";
import { getNodeCumulativePriorities } from "./getNodeCumulativePriorities";

export class PGraph {
  /** Original dependency map for the graph */
  readonly #dependencyMap: ReadonlyMap<string, PGraphNodeWithDependencies>;

  /**
   * Tracks all the nodes that are ready to be executed since it is not depending on the results
   * of any non completed tasks.
   */
  readonly #nodesWithNoDependencies: ReadonlyArray<string>;

  readonly #nodeCumulativePriorities: Readonly<Record<string, number>>;

  /**
   * Create a new graph. Throws an error if a cycle is detected.
   *
   * @param nodeMap Mapping from node ID to function and priority
   * @param dependencies Each tuple describes a dependency between two nodes in the p-graph:
   * the first task must complete before the second one begins.
   */
  constructor(nodeMap: PGraphNodeMap | PGraphNodeRecord, dependencies: DependencyList) {
    const entries = nodeMap instanceof Map ? nodeMap.entries() : Object.entries(nodeMap);
    const entryCount = nodeMap instanceof Map ? nodeMap.size : (entries as unknown[]).length;
    const dependencyMap = new Map<string, PGraphNodeWithDependencies>();

    for (const [key, node] of entries) {
      dependencyMap.set(key, {
        ...node,
        dependsOn: new Set(),
        dependedOnBy: new Set(),
        failed: false,
      });
    }

    for (const [subjectId, dependentId] of dependencies) {
      const subjectNode = dependencyMap.get(subjectId);
      const dependentNode = dependencyMap.get(dependentId);

      if (!subjectNode) {
        throw new Error(
          `Dependency graph referenced node with id ${subjectId}, which was not in the node list`,
        );
      }

      if (!dependentNode) {
        throw new Error(
          `Dependency graph referenced node with id ${dependentId}, which was not in the node list`,
        );
      }

      subjectNode.dependedOnBy.add(dependentId);
      dependentNode.dependsOn.add(subjectId);
    }

    const nodesWithNoDependencies: string[] = [];
    for (const [key, node] of dependencyMap.entries()) {
      if (node.dependsOn.size === 0) {
        nodesWithNoDependencies.push(key);
      }
    }
    this.#nodesWithNoDependencies = nodesWithNoDependencies;

    if (!nodesWithNoDependencies.length && entryCount > 0) {
      throw new Error(
        "We could not find a node in the graph with no dependencies; this likely means there is a cycle including all nodes",
      );
    }

    // Compute priorities and validate that no cycles exist in the graph (throws if so)
    this.#nodeCumulativePriorities = getNodeCumulativePriorities(dependencyMap);
    this.#dependencyMap = dependencyMap;
  }

  /**
   * Runs all the tasks in the promise graph in dependency order.
   * The graph can be run multiple times.
   *
   * Failure behavior:
   * - If `continue` is false or unset and a task fails, the promise will reject immediately with
   *   a **single error**.
   * - If `continue` is true and a task fails, any tasks not dependent on the failed task will
   *   continue running, and an **array of errors** will be thrown at the end.
   */
  run(options?: RunOptions): Promise<void> {
    // Copy the dependency map so the graph can be reused
    const dependencyMap = new Map(
      [...this.#dependencyMap.entries()].map(([key, node]) => [
        key,
        { ...node, dependsOn: new Set(node.dependsOn), dependedOnBy: new Set(node.dependedOnBy) },
      ]),
    );

    const concurrency = options?.concurrency;

    if (concurrency !== undefined && concurrency < 0) {
      throw new Error(
        `concurrency must be either undefined or a positive integer; received ${options?.concurrency}`,
      );
    }

    const priorityQueue = new PriorityQueue<string>();

    for (const itemId of this.#nodesWithNoDependencies) {
      priorityQueue.insert(itemId, this.#nodeCumulativePriorities[itemId]);
    }

    let currentlyRunningTaskCount = 0;

    const scheduleTask = async () => {
      const taskToRunId = priorityQueue.removeMax();

      if (!taskToRunId) {
        throw new Error("Tried to schedule a task when there were no pending tasks!");
      }
      const taskToRun = dependencyMap.get(taskToRunId)!;

      try {
        currentlyRunningTaskCount += 1;

        if (!taskToRun.failed) {
          await taskToRun.run();
        }
      } catch (e) {
        // mark node and its children to be "failed" in the case of continue, we'll traverse, but not run the nodes
        taskToRun.failed = true;
        throw e;
      } finally {
        // schedule next round of tasks if options.continue (continue on error) or successfully run task
        const shouldScheduleMoreTasks = options?.continue || !taskToRun.failed;

        if (shouldScheduleMoreTasks) {
          // "currentlyRunningTaskCount" cannot be decremented on non-continue cases because of async nature of
          // the queue runner. The race condition will end up appearing as if there was no failures even though
          // there was one
          currentlyRunningTaskCount -= 1;

          // Let's remove this task from all dependent task's dependency array
          for (const dependentId of taskToRun.dependedOnBy) {
            const dependentNode = dependencyMap.get(dependentId)!;

            if (taskToRun.failed) {
              dependentNode.failed = true;
            }

            dependentNode.dependsOn.delete(taskToRunId);

            // If the task that just completed was the last remaining dependency for a node,
            // add it to the set of unblocked nodes
            if (dependentNode.dependsOn.size === 0) {
              priorityQueue.insert(dependentId, this.#nodeCumulativePriorities[dependentId]);
            }
          }
        }
      }
    };

    return new Promise((resolve, reject) => {
      let errors: Error[] = [];

      const trySchedulingTasks = () => {
        if (priorityQueue.isEmpty() && currentlyRunningTaskCount === 0) {
          // We are done running all tasks, let's resolve the promise done
          if (errors.length === 0) {
            resolve();
          } else {
            reject(errors);
          }
          return;
        }

        while (
          !priorityQueue.isEmpty() &&
          (concurrency === undefined || currentlyRunningTaskCount < concurrency)
        ) {
          scheduleTask()
            .then(() => trySchedulingTasks())
            .catch((e) => {
              errors.push(e);

              // If continue is set, this merely records what errors have been encountered,
              // then continues execution of the remaining tasks not blocked by a failed task.
              if (options?.continue) {
                trySchedulingTasks();
              } else {
                // immediately reject, if not using "continue" option
                reject(e);
              }
            });
        }
      };

      trySchedulingTasks();
    });
  }
}
