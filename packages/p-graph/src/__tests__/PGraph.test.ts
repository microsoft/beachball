import { describe, it, expect, jest } from '@jest/globals';
import type { DependencyList, PGraphNodeMap, PGraphNodeRecord } from '../types';
import { FunctionScheduler } from './FunctionScheduler';
import { PGraph } from '../PGraph';
import { PGraphError } from '../PGraphError';

describe('PGraph', () => {
  /** Make a map with the given keys and individual no-op runner functions (`jest.fn()`) */
  function makeNodeMap(keys: string[]): PGraphNodeMap {
    return new Map(keys.map(key => [key, { run: jest.fn() }]));
  }

  describe('graph execution', () => {
    it('resolves an empty dependency graph', async () => {
      await expect(new PGraph(new Map(), []).run()).resolves.toBeUndefined();
    });

    it('accepts the dependency graph as an object', async () => {
      const nodeMap: PGraphNodeRecord = {
        A: { run: jest.fn() },
        B: { run: jest.fn() },
      };
      await new PGraph(nodeMap, [['B', 'A']]).run();
      expect(nodeMap.A.run).toHaveBeenCalled();
      expect(nodeMap.B.run).toHaveBeenCalled();
    });

    it('accepts the dependency graph map and executes tasks in order', async () => {
      const scheduler = new FunctionScheduler();
      scheduler.addNodes(['putOnShirt', 'putOnShorts', 'putOnJacket', 'putOnShoes', 'tieShoes']);

      await new PGraph(scheduler.nodeMap, [
        ['putOnShoes', 'tieShoes'],
        ['putOnShirt', 'putOnJacket'],
        ['putOnShorts', 'putOnJacket'],
        ['putOnShorts', 'putOnShoes'],
      ]).run();

      expect(scheduler.hasScheduleOrdering('putOnShoes', 'tieShoes')).toBe(true);
      expect(scheduler.hasScheduleOrdering('putOnShirt', 'putOnJacket')).toBe(true);
      expect(scheduler.hasScheduleOrdering('putOnShorts', 'putOnJacket')).toBe(true);
      expect(scheduler.hasScheduleOrdering('putOnShorts', 'putOnShoes')).toBe(true);
    });

    it('runs all dependencies for disconnected graphs', async () => {
      const scheduler = new FunctionScheduler();
      scheduler.addNodes(['A', 'B', 'C', 'D']);
      //  A      D
      // B C
      await new PGraph(scheduler.nodeMap, [
        ['A', 'B'],
        ['A', 'C'],
      ]).run();

      expect(scheduler.getCompletedTasks().sort()).toEqual(['A', 'B', 'C', 'D']);
    });

    it('correctly schedules tasks that have more than one dependency', async () => {
      const scheduler = new FunctionScheduler();
      scheduler.addNodes(['A', 'B', 'C', 'D', 'E']);
      // All nodes depend on A, D depends on C and B as well
      await new PGraph(scheduler.nodeMap, [
        ['A', 'B'],
        ['A', 'C'],
        ['A', 'D'],
        ['A', 'E'],
        ['C', 'D'],
        ['B', 'D'],
      ]).run();

      expect(scheduler.hasScheduleOrdering('A', 'B')).toBe(true);
      expect(scheduler.hasScheduleOrdering('A', 'C')).toBe(true);
      expect(scheduler.hasScheduleOrdering('A', 'D')).toBe(true);
      expect(scheduler.hasScheduleOrdering('A', 'E')).toBe(true);
      expect(scheduler.hasScheduleOrdering('B', 'D')).toBe(true);
      expect(scheduler.hasScheduleOrdering('C', 'D')).toBe(true);
    });
  });

  describe('concurrency', () => {
    it('runs more than one task at a time', async () => {
      const scheduler = new FunctionScheduler();
      scheduler.addNodes(['A', 'B', 'C']);
      //  A
      // B C
      await new PGraph(scheduler.nodeMap, [
        ['A', 'B'],
        ['A', 'C'],
      ]).run();

      // B and C runs concurrently
      expect(scheduler.getMaxConcurrency()).toEqual(2);
    });

    it('should not exceed maximum concurrency', async () => {
      const scheduler = new FunctionScheduler();
      scheduler.addNodes(['A', 'B', 'C', 'D', 'E']);
      //    A
      // B C D E
      await new PGraph(scheduler.nodeMap, [
        ['A', 'B'],
        ['A', 'C'],
        ['A', 'D'],
        ['A', 'E'],
      ]).run({ concurrency: 3 });

      expect(scheduler.getMaxConcurrency()).toBeLessThanOrEqual(3);
    });
  });

  describe('priority scheduling', () => {
    it('schedules high priority tasks and dependencies before lower priority tasks', async () => {
      const scheduler = new FunctionScheduler();
      scheduler.addNodes(['A', 'B', 'C', 'D', 'E']);
      scheduler.addNode({ name: 'F', duration: 1, priority: 16 });
      //      A
      //  B   C   D
      //    |E F|
      await new PGraph(scheduler.nodeMap, [
        ['A', 'B'],
        ['A', 'C'],
        ['A', 'D'],
        ['C', 'E'],
        ['C', 'F'],
      ]).run({ concurrency: 1 }); // to more easily validate execution order

      // A -> C -> F is the critical path, it should be built first
      expect(scheduler.hasScheduleOrdering('C', 'B')).toBe(true);
      expect(scheduler.hasScheduleOrdering('C', 'D')).toBe(true);
      expect(scheduler.hasScheduleOrdering('F', 'E')).toBe(true);
      expect(scheduler.hasScheduleOrdering('F', 'B')).toBe(true);
      expect(scheduler.hasScheduleOrdering('F', 'D')).toBe(true);
    });

    it('schedules high priority tasks and dependencies before lower priority tasks when maxConcurrency is greater than 1', async () => {
      const scheduler = new FunctionScheduler();
      scheduler.addNode({ name: 'A', duration: 1 });
      scheduler.addNode({ name: 'B', duration: 16, priority: 16 });
      scheduler.addNode({ name: 'C', duration: 4, priority: 4 });
      scheduler.addNode({ name: 'D', duration: 4, priority: 4 });
      scheduler.addNode({ name: 'E', duration: 12, priority: 12 });
      scheduler.addNode({ name: 'F', duration: 16, priority: 16 });

      //      A
      //  B   C   D
      //    |E F|
      await new PGraph(scheduler.nodeMap, [
        ['A', 'B'],
        ['A', 'C'],
        ['A', 'D'],
        ['C', 'E'],
        ['C', 'F'],
      ]).run({ concurrency: 2 });

      // A -> C -> F is the critical path, it should be built first
      expect(scheduler.getMaxConcurrency()).toBeLessThanOrEqual(2);
      expect(scheduler.didStartBefore('C', 'B')).toBe(true);
      expect(scheduler.didStartBefore('C', 'D')).toBe(true);
      expect(scheduler.didStartBefore('B', 'D')).toBe(true);
      expect(scheduler.didStartBefore('F', 'E')).toBe(true);
    });
  });

  describe('invalid graph handling', () => {
    it('throws an exception when the dependency graph has a cycle starting from the root', () => {
      const nodeMap = makeNodeMap(['A', 'B', 'C']);
      const dependencies: DependencyList = [
        ['A', 'B'],
        ['B', 'C'],
        ['C', 'A'],
      ];

      expect(() => new PGraph(nodeMap, dependencies)).toThrow(
        'Could not find a node in the graph with no dependencies'
      );
    });

    it('throws an exception when the dependency graph has a cycle', () => {
      // This is almost the same as the last test, except the root node is not a part of the cycle
      const nodeMap = makeNodeMap(['A', 'B', 'C', 'D', 'E', 'F']);
      const dependencies: DependencyList = [
        ['A', 'B'],
        ['B', 'C'],
        ['C', 'D'],
        ['D', 'B'],
        ['D', 'E'],
      ];
      expect(() => new PGraph(nodeMap, dependencies)).toThrow(
        'A cycle has been detected including the following nodes:\nB\nC\nD'
      );
    });

    it('throws an exception in the first instance of a cycle that has been detected when there are overlapped cycles', () => {
      // This is almost the same as the last test, except the root node is not a part of the cycle
      const nodeMap = makeNodeMap(['A', 'B', 'C', 'D', 'E', 'F']);
      // B -> C -> E -> F -> D is the first cycle detected
      const dependencies: DependencyList = [
        ['A', 'B'],
        ['B', 'C'],
        ['C', 'D'],
        ['D', 'B'],
        ['C', 'E'],
        ['E', 'F'],
        ['F', 'D'],
      ];
      expect(() => new PGraph(nodeMap, dependencies)).toThrow(
        'A cycle has been detected including the following nodes:\nB\nC\nE\nF\nD'
      );
    });

    it('throws when one of the dependencies references a node not in the node map', () => {
      const nodeMap = makeNodeMap(['A', 'B']);
      //  A
      // B C
      const dependencies: DependencyList = [
        ['A', 'B'],
        ['A', 'C'],
      ];
      expect(() => new PGraph(nodeMap, dependencies)).toThrow(
        'Dependency graph referenced node with id "C", which was not in the node list'
      );
    });
  });

  describe('error handling', () => {
    it('throws if a task fails when continue is unset/false', async () => {
      const nodeMap = makeNodeMap(['A', 'B']);
      nodeMap.set('C', { run: () => Promise.reject(new Error('C rejected')) });
      //  A
      // B C
      const dependencies: DependencyList = [
        ['A', 'B'],
        ['A', 'C'],
      ];

      const error = (await new PGraph(nodeMap, dependencies).run().catch(e => e as unknown)) as PGraphError;
      expect(error).toBeInstanceOf(PGraphError);
      expect(error.errors.map(e => String(e))).toEqual(['Error: C rejected']);
      // Check the message format here
      expect(error.message).toMatchInlineSnapshot(`
        "Error(s) occurred during task execution:
        - Error: C rejected"
      `);
    });

    it('if continue is true and a task fails, continues to run other tasks and throws at end', async () => {
      const nodeMap = makeNodeMap(['A', 'B', 'D', 'E', 'F']);
      nodeMap.set('C', { run: () => Promise.reject(new Error('C rejected')) });

      const dependencies: DependencyList = [
        ['A', 'B'],
        ['A', 'C'],
        ['A', 'D'],
        ['C', 'D'],
        ['A', 'E'],
        ['E', 'F'],
      ];

      const error = (await new PGraph(nodeMap, dependencies)
        .run({ concurrency: 1, continue: true })
        .catch(e => e as unknown)) as PGraphError;
      expect(error).toBeInstanceOf(PGraphError);
      expect(error.errors.map(e => String(e))).toEqual(['Error: C rejected']);

      expect(nodeMap.get('E')!.run).toHaveBeenCalled();
      expect(nodeMap.get('F')!.run).toHaveBeenCalled();
      expect(nodeMap.get('D')!.run).not.toHaveBeenCalled();
    });

    it('if continue is true, throws at end for multiple independent failures', async () => {
      const nodeMap = makeNodeMap(['A', 'D', 'F', 'G']);
      nodeMap.set('B', { run: () => Promise.reject(new Error('B rejected')) });
      nodeMap.set('C', { run: () => Promise.reject(new Error('C rejected')) });
      nodeMap.set('E', { run: () => Promise.reject(new Error('E rejected')) });
      //      A
      //  B   C   D
      //      E   F
      //      G
      const dependencies: DependencyList = [
        ['A', 'B'],
        ['A', 'C'],
        ['A', 'D'],
        ['C', 'E'],
        ['D', 'F'],
        ['D', 'G'],
      ];

      // Only B and C should fail (E is skipped because C failed)
      const error = (await new PGraph(nodeMap, dependencies)
        .run({ concurrency: 2, continue: true })
        .catch(e => e as unknown)) as PGraphError;
      expect(error).toBeInstanceOf(PGraphError);
      // Check the message formatting. It converts the original errors to strings, so a thrown
      // Error will have a prefix, but a thrown string won't.
      expect(error.message).toMatchInlineSnapshot(`
        "Error(s) occurred during task execution:
        - Error: B rejected
        - Error: C rejected"
      `);
      expect(error.errors.map(e => String(e))).toEqual(['Error: B rejected', 'Error: C rejected']);

      // Independent successful paths should still execute
      expect(nodeMap.get('A')!.run).toHaveBeenCalled();
      expect(nodeMap.get('D')!.run).toHaveBeenCalled();
      expect(nodeMap.get('F')!.run).toHaveBeenCalled();
      expect(nodeMap.get('G')!.run).toHaveBeenCalled();
    });

    it('works correctly with high concurrency', async () => {
      const scheduler = new FunctionScheduler();
      scheduler.addNodes(['A', 'C', 'D', 'E']);
      scheduler.nodeMap.set('B', { run: () => Promise.reject(new Error('B rejected')) });
      //      A
      //  B   C   D   E
      const dependencies: DependencyList = [
        ['A', 'B'],
        ['A', 'C'],
        ['A', 'D'],
        ['A', 'E'],
      ];

      const error = (await new PGraph(scheduler.nodeMap, dependencies)
        .run({ concurrency: 10, continue: true })
        .catch(e => e as unknown)) as PGraphError;
      expect(error).toBeInstanceOf(PGraphError);
      expect(error.errors.map(e => String(e))).toEqual(['Error: B rejected']);

      // All non-failing tasks should execute
      expect(scheduler.getCompletedTasks().sort()).toEqual(['A', 'C', 'D', 'E']);
      // Max concurrency could be up to 4 (B, C, D, E running simultaneously after A)
      expect(scheduler.getMaxConcurrency()).toBeGreaterThan(1);
    });

    it('handles synchronous errors with continue', async () => {
      const nodeMap = makeNodeMap(['A', 'C']);
      nodeMap.set('B', {
        run: () => {
          throw new Error('B threw synchronously');
        },
      });

      const dependencies: DependencyList = [
        ['A', 'B'],
        ['A', 'C'],
      ];

      const error = (await new PGraph(nodeMap, dependencies)
        .run({ continue: true })
        .catch(e => e as unknown)) as PGraphError;
      expect(error).toBeInstanceOf(PGraphError);
      expect(error.errors.map(e => String(e))).toEqual(['Error: B threw synchronously']);

      expect(nodeMap.get('C')!.run).toHaveBeenCalled();
    });
  });

  describe('getLayers', () => {
    it('returns an empty array for an empty graph', () => {
      expect(new PGraph({}, []).getLayers()).toEqual([]);
    });

    it('returns a single layer for a graph with no dependencies', () => {
      const nodeMap = makeNodeMap(['A', 'B', 'C']);
      expect(new PGraph(nodeMap, []).getLayers()).toEqual([['A', 'B', 'C']]);
    });

    it('organizes nodes into dependency layers', () => {
      const nodeMap = makeNodeMap(['A', 'B', 'C', 'D', 'E']);
      //      E
      //  A   B   D
      //    | C |
      const dependencies: DependencyList = [
        ['E', 'A'],
        ['E', 'B'],
        ['E', 'D'],
        ['A', 'C'],
        ['B', 'C'],
      ];

      const layers = new PGraph(nodeMap, dependencies).getLayers();
      expect(layers).toEqual([['E'], ['A', 'B', 'D'], ['C']]);
    });

    it('places disconnected nodes in the first layer', () => {
      const nodeMap = makeNodeMap(['A', 'B', 'C', 'D']);
      //  A    D
      // B C
      const layers = new PGraph(nodeMap, [
        ['A', 'B'],
        ['A', 'C'],
      ]).getLayers();

      expect(layers).toEqual([
        ['A', 'D'],
        ['B', 'C'],
      ]);
    });

    it('places every node in exactly one layer, respecting dependencies', () => {
      const nodeMap = makeNodeMap(['A', 'B', 'C', 'D', 'E']);
      const dependencies: DependencyList = [
        ['A', 'B'],
        ['A', 'C'],
        ['A', 'D'],
        ['C', 'E'],
        ['B', 'E'],
      ];

      const layers = new PGraph(nodeMap, dependencies).getLayers();

      // All nodes appear exactly once
      expect(layers.flat().sort()).toEqual(['A', 'B', 'C', 'D', 'E']);

      // Each dependency's subject must be in an earlier layer than its dependent
      const layerOf = (id: string) => layers.findIndex(layer => layer.includes(id));
      for (const [subject, dependent] of dependencies) {
        expect(layerOf(subject)).toBeLessThan(layerOf(dependent));
      }
    });

    it('does not sort nodes', () => {
      const nodeMap = makeNodeMap(['D', 'B']);
      nodeMap.set('C', { run: jest.fn(), priority: 16 });
      nodeMap.set('A', { run: jest.fn(), priority: 8 });

      // Currently insertion order is used
      expect(new PGraph(nodeMap, []).getLayers()).toEqual([['D', 'B', 'C', 'A']]);
    });
  });
});
