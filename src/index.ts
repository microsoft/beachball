import { PGraph } from "./PGraph";
import type { PGraphNodeMap, DependencyList, PGraphNodeRecord } from "./types";

export { PGraph };

/**
 * Create a new graph runner from a list of nodes and dependencies (edges).
 * Throws an error if a cycle is detected. (This is the same as `new PGraph(...)`.)
 *
 * @param nodeMap Mapping from node ID to function and priority
 * @param dependencies Each tuple describes a dependency between two nodes in the p-graph:
 * the first task must complete before the second one begins.
 * @returns The graph ready to run
 */
export function pGraph(nodeMap: PGraphNodeMap | PGraphNodeRecord, dependencies: DependencyList) {
  return new PGraph(nodeMap, dependencies);
}

export default pGraph;

export type {
  DependencyList,
  PGraphNode,
  PGraphNodeMap,
  PGraphNodeRecord,
  RunOptions,
} from "./types";
