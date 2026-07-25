import { describe, it, expect } from '@jest/globals';
import { PriorityQueue } from '../PriorityQueue';

describe('PriorityQueue', () => {
  describe('isEmpty', () => {
    it('returns true for a newly created queue', () => {
      const queue = new PriorityQueue();
      expect(queue.isEmpty()).toBe(true);
    });

    it('returns false after inserting an item', () => {
      const queue = new PriorityQueue();
      queue.insert('item', 1);
      expect(queue.isEmpty()).toBe(false);
    });

    it('returns true after inserting and removing all items', () => {
      const queue = new PriorityQueue();
      queue.insert('item', 1);
      queue.removeNext();
      expect(queue.isEmpty()).toBe(true);
    });
  });

  describe('insert', () => {
    it('inserts a single item', () => {
      const queue = new PriorityQueue();
      queue.insert('task1', 5);
      expect(queue.isEmpty()).toBe(false);
      expect(queue.array).toEqual([{ item: 'task1', priority: 5 }]);
    });

    it('inserts multiple items and maintain max heap property', () => {
      const queue = new PriorityQueue();
      queue.insert('low', 1);
      queue.insert('high', 10);
      queue.insert('medium', 5);

      // The highest priority should be at the root (index 0)
      expect(queue.array[0]).toEqual({ item: 'high', priority: 10 });
    });

    it('handles items with same priority', () => {
      const queue = new PriorityQueue();
      queue.insert('task1', 5);
      queue.insert('task2', 5);
      queue.insert('task3', 5);

      expect(queue.array).toHaveLength(3);
      // It would also be valid to put task2 or task3 in front, but this is the
      // current implementation
      expect(queue.array[0].priority).toBe(5);
    });

    it('maintains heap property when inserting in ascending priority order', () => {
      const queue = new PriorityQueue();
      for (let i = 1; i <= 10; i++) {
        queue.insert(`task${i}`, i);
      }

      // Root should have the highest priority
      expect(queue.array[0].priority).toBe(10);
    });

    it('maintains heap property when inserting in descending priority order', () => {
      const queue = new PriorityQueue();
      for (let i = 10; i >= 1; i--) {
        queue.insert(`task${i}`, i);
      }

      // Root should have the highest priority
      expect(queue.array[0].priority).toBe(10);
    });

    it('maintains heap property when inserting in random order', () => {
      const queue = new PriorityQueue();
      const priorities = [5, 2, 8, 1, 9, 3, 7, 4, 6];
      priorities.forEach(p => queue.insert(`task${p}`, p));

      expect(queue.array[0].priority).toBe(9);
    });
  });

  describe('removeMax', () => {
    it('returns undefined for an empty queue', () => {
      const queue = new PriorityQueue();
      expect(queue.removeNext()).toBeUndefined();
    });

    it('returns the only item in a single-item queue', () => {
      const queue = new PriorityQueue();
      queue.insert('only', 5);
      expect(queue.removeNext()).toBe('only');
      expect(queue.isEmpty()).toBe(true);
    });

    it('returns items in descending priority order', () => {
      const queue = new PriorityQueue();
      queue.insert('low', 1);
      queue.insert('high', 10);
      queue.insert('medium', 5);

      expect(queue.removeNext()).toBe('high');
      expect(queue.removeNext()).toBe('medium');
      expect(queue.removeNext()).toBe('low');
      expect(queue.isEmpty()).toBe(true);
    });

    it('maintains order after removals', () => {
      const queue = new PriorityQueue();
      const priorities = [5, 2, 8, 1, 9, 3, 7, 4, 6];
      priorities.forEach(p => queue.insert(`task${p}`, p));

      // Remove the max and check that the new max is correct
      expect(queue.removeNext()).toBe('task9');
      expect(queue.array[0].priority).toBe(8);

      expect(queue.removeNext()).toBe('task8');
      expect(queue.array[0].priority).toBe(7);

      expect(queue.removeNext()).toBe('task7');
      expect(queue.array[0].priority).toBe(6);
    });

    it('returns more items in descending priority order', () => {
      const queue = new PriorityQueue();
      const priorities = [5, 2, 8, 1, 9, 3, 7, 4, 6];
      priorities.forEach(p => queue.insert(`task${p}`, p));

      const removed: string[] = [];
      while (!queue.isEmpty()) {
        removed.push(queue.removeNext()!);
      }
      expect(removed).toEqual(
        [...priorities]
          .sort()
          .reverse()
          .map(p => `task${p}`)
      );
    });

    it('handles multiple items with same priority', () => {
      const queue = new PriorityQueue();
      queue.insert('task1', 5);
      queue.insert('task2', 5);
      queue.insert('task3', 5);

      const result1 = queue.removeNext();
      const result2 = queue.removeNext();
      const result3 = queue.removeNext();

      // All should be returned (order among same priority may vary)
      expect([result1, result2, result3].sort()).toEqual(['task1', 'task2', 'task3']);
      expect(queue.isEmpty()).toBe(true);
    });

    it('handles alternating inserts and removes', () => {
      const queue = new PriorityQueue();

      queue.insert('task1', 5);
      queue.insert('task2', 3);
      expect(queue.removeNext()).toBe('task1');

      queue.insert('task3', 7);
      queue.insert('task4', 2);
      expect(queue.removeNext()).toBe('task3');

      expect(queue.removeNext()).toBe('task2');
      expect(queue.removeNext()).toBe('task4');
      expect(queue.isEmpty()).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('handles negative priorities', () => {
      const queue = new PriorityQueue();
      queue.insert('neg', -5);
      queue.insert('zero', 0);
      queue.insert('pos', 5);

      expect(queue.removeNext()).toBe('pos');
      expect(queue.removeNext()).toBe('zero');
      expect(queue.removeNext()).toBe('neg');
    });

    it('handles floating point priorities', () => {
      const queue = new PriorityQueue();
      queue.insert('low', 1.5);
      queue.insert('high', 10.9);
      queue.insert('medium', 5.3);

      expect(queue.removeNext()).toBe('high');
      expect(queue.removeNext()).toBe('medium');
      expect(queue.removeNext()).toBe('low');
    });

    it('handles very large priorities', () => {
      const queue = new PriorityQueue();
      queue.insert('huge', Number.MAX_SAFE_INTEGER);
      queue.insert('tiny', 1);
      queue.insert('medium', 1000);

      expect(queue.removeNext()).toBe('huge');
    });
  });
});
