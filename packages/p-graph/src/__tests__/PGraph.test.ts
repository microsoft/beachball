import { describe, it, expect, jest } from '@jest/globals';
import type { DependencyList, PGraphNodeMap, PGraphNodeRecord } from '../types';
import { FunctionScheduler } from './FunctionScheduler';
import { PGraph } from '../PGraph';
import { PGraphError } from '../PGraphError';

describe('PGraph', () => {
  /** Make a map with the given keys and no-op runner functions (`jest.fn()`) */
  function makeNoOpMap(keys: string[]): PGraphNodeMap {
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

      const dependencies: DependencyList = [['B', 'A']];

      await new PGraph(nodeMap, dependencies).run();
      expect(nodeMap.A.run).toHaveBeenCalled();
      expect(nodeMap.B.run).toHaveBeenCalled();
    });

    it('accepts the dependency graph map and executes tasks in order', async () => {
      const scheduler = new FunctionScheduler();
      scheduler.addNode({ name: 'putOnShirt', duration: 1 });
      scheduler.addNode({ name: 'putOnShorts', duration: 1 });
      scheduler.addNode({ name: 'putOnJacket', duration: 1 });
      scheduler.addNode({ name: 'putOnShoes', duration: 1 });
      scheduler.addNode({ name: 'tieShoes', duration: 1 });

      const dependencies: DependencyList = [
        ['putOnShoes', 'tieShoes'],
        ['putOnShirt', 'putOnJacket'],
        ['putOnShorts', 'putOnJacket'],
        ['putOnShorts', 'putOnShoes'],
      ];

      await new PGraph(scheduler.nodeMap, dependencies).run();

      expect(scheduler.hasScheduleOrdering('putOnShoes', 'tieShoes')).toBe(true);
      expect(scheduler.hasScheduleOrdering('putOnShirt', 'putOnJacket')).toBe(true);
      expect(scheduler.hasScheduleOrdering('putOnShorts', 'putOnJacket')).toBe(true);
      expect(scheduler.hasScheduleOrdering('putOnShorts', 'putOnShoes')).toBe(true);
    });

    it('runs all dependencies for disconnected graphs', async () => {
      const scheduler = new FunctionScheduler();
      scheduler.addNode({ name: 'A', duration: 1 });
      scheduler.addNode({ name: 'B', duration: 1 });
      scheduler.addNode({ name: 'C', duration: 1 });
      scheduler.addNode({ name: 'D', duration: 1 });

      //  A    D
      // B C
      const dependencies: DependencyList = [
        ['A', 'B'],
        ['A', 'C'],
      ];

      await new PGraph(scheduler.nodeMap, dependencies).run();

      expect(scheduler.didCompleteTask('A')).toBe(true);
      expect(scheduler.didCompleteTask('B')).toBe(true);
      expect(scheduler.didCompleteTask('C')).toBe(true);
      expect(scheduler.didCompleteTask('D')).toBe(true);
    });

    it('correctly schedules tasks that have more than one dependency', async () => {
      const scheduler = new FunctionScheduler();
      scheduler.addNode({ name: 'A', duration: 1 });
      scheduler.addNode({ name: 'B', duration: 1 });
      scheduler.addNode({ name: 'C', duration: 1 });
      scheduler.addNode({ name: 'D', duration: 1 });
      scheduler.addNode({ name: 'E', duration: 1 });

      // All nodes depend on A, D depends on C and B as well
      const dependencies: DependencyList = [
        ['A', 'B'],
        ['A', 'C'],
        ['A', 'D'],
        ['A', 'E'],
        ['C', 'D'],
        ['B', 'D'],
      ];

      await new PGraph(scheduler.nodeMap, dependencies).run();

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
      scheduler.addNode({ name: 'A', duration: 1 });
      scheduler.addNode({ name: 'B', duration: 1 });
      scheduler.addNode({ name: 'C', duration: 1 });

      //  A
      // B C
      const dependencies: DependencyList = [
        ['A', 'B'],
        ['A', 'C'],
      ];

      await new PGraph(scheduler.nodeMap, dependencies).run();

      // B and C runs concurrently
      expect(scheduler.getMaxConcurrency()).toEqual(2);
    });

    it('should not exceed maximum concurrency', async () => {
      const scheduler = new FunctionScheduler();
      scheduler.addNode({ name: 'A', duration: 1 });
      scheduler.addNode({ name: 'B', duration: 1 });
      scheduler.addNode({ name: 'C', duration: 1 });
      scheduler.addNode({ name: 'D', duration: 1 });
      scheduler.addNode({ name: 'E', duration: 1 });

      //    A
      // B C D E
      const dependencies: DependencyList = [
        ['A', 'B'],
        ['A', 'C'],
        ['A', 'D'],
        ['A', 'E'],
      ];

      await new PGraph(scheduler.nodeMap, dependencies).run({ concurrency: 3 });

      expect(scheduler.getMaxConcurrency()).toBeLessThanOrEqual(3);
    });
  });

  describe('priority scheduling', () => {
    it('schedules high priority tasks and dependencies before lower priority tasks', async () => {
      const scheduler = new FunctionScheduler();
      scheduler.addNode({ name: 'A', duration: 1 });
      scheduler.addNode({ name: 'B', duration: 1 });
      scheduler.addNode({ name: 'C', duration: 1 });
      scheduler.addNode({ name: 'D', duration: 1 });
      scheduler.addNode({ name: 'E', duration: 1 });
      scheduler.addNode({ name: 'F', duration: 1, priority: 16 });

      //      A
      //  B   C   D
      //    |E F|
      const dependencies: DependencyList = [
        ['A', 'B'],
        ['A', 'C'],
        ['A', 'D'],
        ['C', 'E'],
        ['C', 'F'],
      ];

      // Set concurrency to 1 to make it easier to validate execution order
      await new PGraph(scheduler.nodeMap, dependencies).run({ concurrency: 1 });

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
      const dependencies: DependencyList = [
        ['A', 'B'],
        ['A', 'C'],
        ['A', 'D'],
        ['C', 'E'],
        ['C', 'F'],
      ];

      // Set concurrency to 1 to make it easier to validate execution order
      await new PGraph(scheduler.nodeMap, dependencies).run({ concurrency: 2 });

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
      const nodeMap = makeNoOpMap(['A', 'B', 'C']);
      const dependencies: DependencyList = [
        ['A', 'B'],
        ['B', 'C'],
        ['C', 'A'],
      ];

      expect(() => new PGraph(nodeMap, dependencies)).toThrowErrorMatchingInlineSnapshot(
        `"We could not find a node in the graph with no dependencies; this likely means there is a cycle including all nodes"`
      );
    });

    it('throws an exception when the dependency graph has a cycle', () => {
      // This is almost the same as the last test, except the root node is not a part of the cycle
      const nodeMap = makeNoOpMap(['A', 'B', 'C', 'D', 'E', 'F']);
      const dependencies: DependencyList = [
        ['A', 'B'],
        ['B', 'C'],
        ['C', 'D'],
        ['D', 'B'],
        ['D', 'E'],
      ];
      expect(() => new PGraph(nodeMap, dependencies)).toThrowErrorMatchingInlineSnapshot(`
        "A cycle has been detected including the following nodes:
        B
        C
        D"
      `);
    });

    it('throws an exception in the first instance of a cycle that has been detected when there are overlapped cycles', () => {
      // This is almost the same as the last test, except the root node is not a part of the cycle
      const nodeMap = makeNoOpMap(['A', 'B', 'C', 'D', 'E', 'F']);
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

      expect(() => new PGraph(nodeMap, dependencies)).toThrowErrorMatchingInlineSnapshot(`
       "A cycle has been detected including the following nodes:
       B
       C
       E
       F
       D"
      `);
    });

    it('throws when one of the dependencies references a node not in the node map', () => {
      const nodeMap = makeNoOpMap(['A', 'B']);

      //  A
      // B C
      const dependencies: DependencyList = [
        ['A', 'B'],
        ['A', 'C'],
      ];

      expect(() => new PGraph(nodeMap, dependencies)).toThrow();
    });
  });

  describe('error handling', () => {
    it('throws if a task fails when continue is unset/false', async () => {
      const nodeMap = makeNoOpMap(['A', 'B']);
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
      const nodeMap = makeNoOpMap(['A', 'B', 'D', 'E', 'F']);
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
      const nodeMap = makeNoOpMap(['A', 'D', 'F', 'G']);
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
      scheduler.addNode({ name: 'A', duration: 1 });
      scheduler.addNode({ name: 'C', duration: 1 });
      scheduler.addNode({ name: 'D', duration: 1 });
      scheduler.addNode({ name: 'E', duration: 1 });
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
      expect(scheduler.didCompleteTask('C')).toBe(true);
      expect(scheduler.didCompleteTask('D')).toBe(true);
      expect(scheduler.didCompleteTask('E')).toBe(true);
      // Max concurrency could be up to 4 (B, C, D, E running simultaneously after A)
      expect(scheduler.getMaxConcurrency()).toBeGreaterThan(1);
    });

    it('handles synchronous errors with continue', async () => {
      const nodeMap = makeNoOpMap(['A', 'C']);
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
});
