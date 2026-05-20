import { describe, it, expect } from '@jest/globals';
import { getNodeCumulativePriorities } from '../getNodeCumulativePriorities';
import type { PGraphNodeWithDependencies } from '../types';

type PGraphDependencyRecord = Record<string, PGraphNodeWithDependencies>;

describe('getNodeCumulativePriorities', () => {
  function createNode(
    params: {
      priority?: number;
      dependsOn?: string[];
      dependedOnBy?: string[];
    } = {}
  ): PGraphNodeWithDependencies {
    const { priority, dependsOn = [], dependedOnBy = [] } = params;
    return {
      run: async () => {},
      priority,
      dependsOn: new Set(dependsOn),
      dependedOnBy: new Set(dependedOnBy),
      failed: false,
    };
  }

  /** Convenience wrapper that accepts the deps as an object */
  function getNodeCumulativePrioritiesWrapper(dependencyMap: PGraphDependencyRecord) {
    return getNodeCumulativePriorities(new Map(Object.entries(dependencyMap)));
  }

  it('returns empty graph for empty map', () => {
    const result = getNodeCumulativePrioritiesWrapper({});
    expect(result).toEqual({});
  });

  it('returns priority for single leaf node', () => {
    const result = getNodeCumulativePrioritiesWrapper({
      a: createNode({ priority: 5 }),
    });
    expect(result).toEqual({ a: 5 });
  });

  it('returns 0 for single leaf node with no priority', () => {
    const result = getNodeCumulativePrioritiesWrapper({
      a: createNode(),
    });
    expect(result).toEqual({ a: 0 });
  });

  it('handles single root node with one child', () => {
    const dependencyMap: PGraphDependencyRecord = {
      a: createNode({ priority: 3, dependedOnBy: ['b'] }),
      b: createNode({ priority: 2, dependsOn: ['a'] }),
    };

    const result = getNodeCumulativePrioritiesWrapper(dependencyMap);
    expect(result).toEqual({ a: 5 /* 3+2 */, b: 2 });
  });

  it('handles multiple nodes with undefined priority as 0', () => {
    const result = getNodeCumulativePrioritiesWrapper({
      a: createNode({ dependedOnBy: ['b'] }),
      b: createNode({ dependsOn: ['a'] }),
    });
    expect(result).toEqual({ b: 0, a: 0 });
  });

  it('handles only one node with non-zero priority', () => {
    // A(0) → B(0) → C(10)
    const dependencyMap: PGraphDependencyRecord = {
      a: createNode({ priority: 0, dependedOnBy: ['b'] }),
      b: createNode({ priority: 0, dependsOn: ['a'], dependedOnBy: ['c'] }),
      c: createNode({ priority: 10, dependsOn: ['b'] }),
    };

    const result = getNodeCumulativePrioritiesWrapper(dependencyMap);
    expect(result).toEqual({
      c: 10,
      b: 10, // 0 + 10
      a: 10, // 0 + 0 + 10
    });
  });

  it('accumulates priorities over linear chain', () => {
    // A(1) → B(1) → C(1) → D(1) → E(1)
    const dependencyMap: PGraphDependencyRecord = {
      a: createNode({ priority: 1, dependedOnBy: ['b'] }),
      b: createNode({ priority: 1, dependsOn: ['a'], dependedOnBy: ['c'] }),
      c: createNode({ priority: 1, dependsOn: ['b'], dependedOnBy: ['d'] }),
      d: createNode({ priority: 1, dependsOn: ['c'], dependedOnBy: ['e'] }),
      e: createNode({ priority: 1, dependsOn: ['d'] }),
    };

    const result = getNodeCumulativePrioritiesWrapper(dependencyMap);
    expect(result).toEqual({
      e: 1,
      d: 2, // 1 + 1
      c: 3, // 1 + 2
      b: 4, // 1 + 3
      a: 5, // 1 + 4
    });
  });

  it('takes max of multiple children in diamond graph', () => {
    // A → B → D
    //   → C →
    const dependencyMap: PGraphDependencyRecord = {
      a: createNode({ priority: 1, dependedOnBy: ['b', 'c'] }),
      b: createNode({ priority: 2, dependsOn: ['a'], dependedOnBy: ['d'] }),
      c: createNode({ priority: 5, dependsOn: ['a'], dependedOnBy: ['d'] }),
      d: createNode({ priority: 10, dependsOn: ['b', 'c'] }),
    };

    const result = getNodeCumulativePrioritiesWrapper(dependencyMap);
    expect(result).toEqual({
      a: 16, // 1 + max(12, 15) = 1 + 15
      b: 12, // 2 + 10
      c: 15, // 5 + 10
      d: 10, // leaf
    });
  });

  it('handles wide graph with many children', () => {
    // A → B, C, D, E, F (all leaves with different priorities)
    const dependencyMap: PGraphDependencyRecord = {
      a: createNode({ priority: 1, dependedOnBy: ['b', 'c', 'd', 'e', 'f'] }),
      b: createNode({ priority: 10, dependsOn: ['a'] }),
      c: createNode({ priority: 5, dependsOn: ['a'] }),
      d: createNode({ priority: 20, dependsOn: ['a'] }),
      e: createNode({ priority: 3, dependsOn: ['a'] }),
      f: createNode({ priority: 15, dependsOn: ['a'] }),
    };

    const result = getNodeCumulativePrioritiesWrapper(dependencyMap);
    expect(result).toEqual({
      b: 10,
      c: 5,
      d: 20,
      e: 3,
      f: 15,
      a: 21, // 1 + max(10, 5, 20, 3, 15) = 1 + 20
    });
  });

  it('handles multiple disconnected components', () => {
    const dependencyMap: PGraphDependencyRecord = {
      // Component 1: A → B
      a: createNode({ priority: 1, dependedOnBy: ['b'] }),
      b: createNode({ priority: 2, dependsOn: ['a'] }),

      // Component 2: C → D
      c: createNode({ priority: 3, dependedOnBy: ['d'] }),
      d: createNode({ priority: 4, dependsOn: ['c'] }),
    };

    const result = getNodeCumulativePrioritiesWrapper(dependencyMap);
    expect(result).toEqual({
      a: 3, // 1 + 2
      b: 2,
      c: 7, // 3 + 4
      d: 4,
    });
  });

  it('handles complex DAG with multiple paths', () => {
    const dependencyMap: PGraphDependencyRecord = {
      // A → B → D
      // A → C → D
      // B → E
      a: createNode({ priority: 1, dependedOnBy: ['b', 'c'] }),
      b: createNode({ priority: 2, dependsOn: ['a'], dependedOnBy: ['d', 'e'] }),
      c: createNode({ priority: 3, dependsOn: ['a'], dependedOnBy: ['d'] }),
      d: createNode({ priority: 4, dependsOn: ['b', 'c'] }),
      e: createNode({ priority: 5, dependsOn: ['b'] }),
    };

    const result = getNodeCumulativePrioritiesWrapper(dependencyMap);
    expect(result).toEqual({
      d: 4, // leaf
      e: 5, // leaf
      b: 7, // 2 + max(4, 5) = 2 + 5
      c: 7, // 3 + 4
      a: 8, // 1 + max(7, 7) = 1 + 7
    });
  });

  it('throws error when cycle is detected', () => {
    // Create a cycle: A → B → C → A
    const dependencyMap: PGraphDependencyRecord = {
      a: createNode({ priority: 1, dependsOn: ['c'], dependedOnBy: ['b'] }),
      b: createNode({ priority: 2, dependsOn: ['a'], dependedOnBy: ['c'] }),
      c: createNode({ priority: 3, dependsOn: ['b'], dependedOnBy: ['a'] }),
      d: createNode({}),
    };

    expect(() => getNodeCumulativePrioritiesWrapper(dependencyMap)).toThrowErrorMatchingInlineSnapshot(`
     "A cycle has been detected including the following nodes:
     a
     b
     c"
    `);
  });
});
