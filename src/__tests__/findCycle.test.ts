import { findCycle } from "../findCycle";
import type { PGraphNodeWithDependencies } from "../types";

type PGraphDependencyRecord = Record<string, PGraphNodeWithDependencies>;

describe("findCycle", () => {
  function createNode(params: { dependedOnBy?: string[] }): PGraphNodeWithDependencies {
    return {
      run: async () => {},
      dependsOn: new Set(), // not used
      dependedOnBy: new Set(params.dependedOnBy || []),
      failed: false,
    };
  }

  function makeDependencyMap(
    deps: PGraphDependencyRecord,
  ): Map<string, PGraphNodeWithDependencies> {
    return new Map(Object.entries(deps));
  }

  it("detects a simple two-node cycle", () => {
    // A → B → A
    const dependencyMap = makeDependencyMap({
      a: createNode({ dependedOnBy: ["b"] }),
      b: createNode({ dependedOnBy: ["a"] }),
    });

    const cycleNodes = findCycle(["a", "b"], dependencyMap);

    expect(cycleNodes).toEqual(["a", "b"]);
  });

  it("detects a three-node cycle", () => {
    // A → B → C → A
    const dependencyMap = makeDependencyMap({
      a: createNode({ dependedOnBy: ["b"] }),
      b: createNode({ dependedOnBy: ["c"] }),
      c: createNode({ dependedOnBy: ["a"] }),
    });

    const cycleNodes = findCycle(["a", "b", "c"], dependencyMap);

    expect(cycleNodes).toEqual(["a", "b", "c"]);
  });

  it("detects a self-loop", () => {
    // A → A
    const dependencyMap = makeDependencyMap({
      a: createNode({ dependedOnBy: ["a"] }),
    });

    const cycleNodes = findCycle(["a"], dependencyMap);

    expect(cycleNodes).toEqual(["a"]);
  });

  it("returns undefined when there are no cycles", () => {
    // A → B (no cycle, but both unprocessed)
    const dependencyMap = makeDependencyMap({
      a: createNode({ dependedOnBy: ["b"] }),
      b: createNode({}),
    });

    const cycleNodes = findCycle(["a", "b"], dependencyMap);

    expect(cycleNodes).toBeUndefined();
  });

  // This should be impossible input from getNodeCumulativePriorities if there's actually a cycle
  it("returns undefined when unprocessed nodes list is empty", () => {
    const dependencyMap = makeDependencyMap({
      a: createNode({ dependedOnBy: ["a"] }),
      b: createNode({}),
    });

    const cycleNodes = findCycle([], dependencyMap);

    expect(cycleNodes).toBeUndefined();
  });

  it("detects only nodes in cycles when some unprocessed nodes are not in cycles", () => {
    // A → B → A (cycle)
    // C (isolated, not in cycle)
    const dependencyMap = makeDependencyMap({
      a: createNode({ dependedOnBy: ["b"] }),
      b: createNode({ dependedOnBy: ["a"] }),
      c: createNode({}),
    });

    const cycleNodes = findCycle(["a", "b", "c"], dependencyMap);

    expect(cycleNodes).toEqual(["a", "b"]);
  });

  it("returns first cycle if there are multiple independent cycles", () => {
    // A → B → A (cycle 1)
    // C → D → C (cycle 2)
    const dependencyMap = makeDependencyMap({
      a: createNode({ dependedOnBy: ["b"] }),
      b: createNode({ dependedOnBy: ["a"] }),
      c: createNode({ dependedOnBy: ["d"] }),
      d: createNode({ dependedOnBy: ["c"] }),
    });

    const cycleNodes = findCycle(["a", "b", "c", "d"], dependencyMap);

    expect(cycleNodes).toEqual(["a", "b"]);
  });

  it("returns first overlapping cycle found", () => {
    // A → B → C → A (cycle 1)
    // B → D → B (cycle 2, shares node B with cycle 1)
    const dependencyMap = makeDependencyMap({
      a: createNode({ dependedOnBy: ["b"] }),
      b: createNode({ dependedOnBy: ["c", "d"] }),
      c: createNode({ dependedOnBy: ["a"] }),
      d: createNode({ dependedOnBy: ["b"] }),
    });

    const cycleNodes = findCycle(["a", "b", "c", "d"], dependencyMap);

    expect(cycleNodes).toEqual(["b", "d"]);
  });

  // This should be impossible input from getNodeCumulativePriorities
  it("includes paths through processed nodes", () => {
    // A → B → C → A
    const dependencyMap = makeDependencyMap({
      a: createNode({ dependedOnBy: ["b"] }),
      b: createNode({ dependedOnBy: ["c"] }),
      c: createNode({ dependedOnBy: ["a"] }),
    });

    // Only A and B are unprocessed, C was processed
    // (shouldn't be possible from getNodeCumulativePriorities)
    const cycleNodes = findCycle(["a", "b"], dependencyMap);

    expect(cycleNodes).toEqual(["a", "b", "c"]);
  });

  it("detects a larger cycle with multiple nodes", () => {
    // A → B → C → D → E → A
    const dependencyMap = makeDependencyMap({
      a: createNode({ dependedOnBy: ["b"] }),
      b: createNode({ dependedOnBy: ["c"] }),
      c: createNode({ dependedOnBy: ["d"] }),
      d: createNode({ dependedOnBy: ["e"] }),
      e: createNode({ dependedOnBy: ["a"] }),
    });

    const cycleNodes = findCycle(["a", "b", "c", "d", "e"], dependencyMap);

    expect(cycleNodes).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("detects cycle when nodes have multiple children", () => {
    // A → B, C
    // B → D
    // C → D
    // D → A (cycle: A → B → D → A and A → C → D → A)
    const dependencyMap = makeDependencyMap({
      a: createNode({ dependedOnBy: ["b", "c"] }),
      b: createNode({ dependedOnBy: ["d"] }),
      c: createNode({ dependedOnBy: ["d"] }),
      d: createNode({ dependedOnBy: ["a"] }),
    });

    const cycleNodes = findCycle(["a", "b", "c", "d"], dependencyMap);

    expect(cycleNodes).toEqual(["a", "c", "d"]);
  });

  it("handles complex graph with multiple cycles among many nodes", () => {
    // A → B → C → D → E
    //     ↓   ↑   ↑
    //     F → G → H (cycle: B → C → D → B and B → F → G → H → D → B)
    const dependencyMap = makeDependencyMap({
      a: createNode({ dependedOnBy: ["b"] }),
      b: createNode({ dependedOnBy: ["c", "f"] }),
      c: createNode({ dependedOnBy: ["d"] }),
      d: createNode({ dependedOnBy: ["b", "e"] }),
      e: createNode({}),
      f: createNode({ dependedOnBy: ["g"] }),
      g: createNode({ dependedOnBy: ["h"] }),
      h: createNode({ dependedOnBy: ["d"] }),
    });

    // All nodes except A and E are part of the cycle
    const cycleNodes = findCycle(["b", "c", "d", "f", "g", "h"], dependencyMap);

    expect(cycleNodes).toEqual(["b", "f", "g", "h", "d"]);
  });
});
