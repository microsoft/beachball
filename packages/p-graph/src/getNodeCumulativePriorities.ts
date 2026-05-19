import { findCycle } from "./findCycle";
import type { PGraphNodeWithDependencies } from "./types";

/**
 * Calculates the "cumulative" priority for each node: the priority of the current node plus the
 * maximum cumulative priority amongst all children. This is helpful for identifying which nodes
 * to schedule first in order to get to higher priority nodes more quickly.
 *
 * Uses a reverse Kahn's algorithm (BFS from leaves to roots) to calculate priorities in a single pass.
 * Throws if a cycle is detected.
 *
 * @param dependencyMap - Mapping from node ID to dependency information
 */
export function getNodeCumulativePriorities(
  dependencyMap: Map<string, PGraphNodeWithDependencies>,
): Record<string, number> {
  const nodeCumulativePriorities: Record<string, number> = {};
  const childrenRemainingCount: Record<string, number> = {};
  const queue: string[] = [];

  // Initialize: Find leaf nodes and count children for each node
  for (const [nodeId, node] of dependencyMap.entries()) {
    const childrenCount = node.dependedOnBy.size;
    childrenRemainingCount[nodeId] = childrenCount;

    if (childrenCount === 0) {
      // Leaf node - ready to process immediately
      queue.push(nodeId);
    }
  }

  // Process nodes in reverse topological order (leaves → roots)
  let currentNodeId: string | undefined;
  while ((currentNodeId = queue.shift())) {
    const node = dependencyMap.get(currentNodeId)!;
    const currentNodePriority = node.priority || 0;

    // Calculate max cumulative priority from all children
    let maxChildCumulativePriority = 0;
    for (const childId of node.dependedOnBy) {
      const childCumulativePriority = nodeCumulativePriorities[childId];
      if (childCumulativePriority === undefined) {
        throw new Error(
          `Expected to have already computed the cumulative priority for node ${childId}`,
        );
      }
      maxChildCumulativePriority = Math.max(maxChildCumulativePriority, childCumulativePriority);
    }

    // Store cumulative priority for this node
    nodeCumulativePriorities[currentNodeId] = currentNodePriority + maxChildCumulativePriority;

    // Update parents: when all children processed, parent is ready
    for (const parentId of node.dependsOn) {
      const remaining = childrenRemainingCount[parentId] - 1;
      childrenRemainingCount[parentId] = remaining;

      if (remaining === 0) {
        // All children of this parent are now processed
        queue.push(parentId);
      }
    }
  }

  // Detect cycles: if not all nodes were processed, there's a cycle
  const processedCount = Object.keys(nodeCumulativePriorities).length;
  if (processedCount !== dependencyMap.size) {
    const unprocessedNodes = Array.from(dependencyMap.keys()).filter(
      (nodeId) => !(nodeId in nodeCumulativePriorities),
    );

    // Find the first cycle (which might not be the only cycle), or fall back to showing
    // all unprocessed nodes
    const cycleNodes = findCycle(unprocessedNodes, dependencyMap) || unprocessedNodes;

    throw new Error(
      `A cycle has been detected including the following nodes:\n${cycleNodes.join("\n")}`,
    );
  }

  return nodeCumulativePriorities;
}
