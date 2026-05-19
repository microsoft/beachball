import type { PGraphNodeWithDependencies } from "./types";

/**
 * `getNodeCumulativePriorites` identifies if nodes are connected to a cycle in any way,
 * but it doesn't pinpoint the exact nodes involved. This function finds the first cycle
 * in the `unprocessedNodes` by checking if the node can reach itself through its children.
 *
 * @param unprocessedNodes List of node not processed by Kahn's algorithm
 * (meaning they're somehow connected to a cycle)
 * @param dependencyMap Full node map
 * @returns List of nodes in first cycle found, or undefined if no cycles are found
 */
export function findCycle(
  unprocessedNodes: string[],
  dependencyMap: Map<string, Pick<PGraphNodeWithDependencies, "dependedOnBy">>,
): string[] | undefined {
  const visitMap: VisitMap = new Map();

  for (const nodeId of unprocessedNodes) {
    if (!visitMap.has(nodeId)) {
      const cycle = searchForCycleDFS(dependencyMap, visitMap, nodeId);
      if (cycle?.length) {
        return cycle;
      }
    }
  }

  return undefined;
}

/**
 * Mapping from node ID to whether it's currently being visited (`true`)
 * or is already fully traversed (`false`). No entry means not visited yet.
 */
type VisitMap = Map<string, boolean>;

interface StackElement {
  nodeId: string;
  traversing: boolean;
}

const searchForCycleDFS = (
  graph: Map<string, Pick<PGraphNodeWithDependencies, "dependedOnBy">>,
  visitMap: VisitMap,
  nodeId: string,
): string[] | undefined => {
  const stack: StackElement[] = [{ nodeId, traversing: false }];
  while (stack.length > 0) {
    const current = stack[stack.length - 1];

    if (current.traversing) {
      // The current node has now been fully traversed.
      visitMap.set(current.nodeId, false);
      stack.pop();
    } else {
      const visitedState = visitMap.get(current.nodeId);
      if (visitedState === true) {
        // The current node has already been visited, hence there is a cycle.
        const listOfCycle = stack.filter((i) => i.traversing).map((a) => a.nodeId);
        return listOfCycle.slice(listOfCycle.indexOf(current.nodeId));
      } else if (visitedState === false) {
        // The current node has already been fully traversed
        stack.pop();
        continue;
      }

      // The current node is starting its traversal
      visitMap.set(current.nodeId, true);
      current.traversing = true;

      // Get the current node in the graph
      const node = graph.get(current.nodeId);
      if (!node) {
        throw new Error(`Could not find node "${current.nodeId}" in the graph`);
      }

      // Add the current node's dependents to the stack
      stack.push(...[...node.dependedOnBy].map((n) => ({ nodeId: n, traversing: false })));
    }
  }

  return undefined;
};
