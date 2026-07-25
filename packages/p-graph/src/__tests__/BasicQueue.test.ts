import { describe, it, expect } from '@jest/globals';
import { BasicQueue } from '../BasicQueue';

describe('BasicQueue', () => {
  describe('isEmpty', () => {
    it('returns true for a newly created queue', () => {
      const queue = new BasicQueue();
      expect(queue.isEmpty()).toBe(true);
    });

    it('returns false after inserting an item', () => {
      const queue = new BasicQueue();
      queue.insert('item');
      expect(queue.isEmpty()).toBe(false);
    });

    it('returns true after inserting and removing all items', () => {
      const queue = new BasicQueue();
      queue.insert('item');
      queue.removeNext();
      expect(queue.isEmpty()).toBe(true);
    });
  });

  describe('removeNext', () => {
    it('returns undefined for an empty queue', () => {
      const queue = new BasicQueue();
      expect(queue.removeNext()).toBeUndefined();
    });

    it('returns undefined after all items are removed', () => {
      const queue = new BasicQueue();
      queue.insert('a');
      queue.removeNext();
      expect(queue.removeNext()).toBeUndefined();
    });

    it('returns items in FIFO order', () => {
      const queue = new BasicQueue();
      queue.insert('a');
      queue.insert('b');
      queue.insert('c');

      expect(queue.removeNext()).toBe('a');
      expect(queue.removeNext()).toBe('b');
      expect(queue.removeNext()).toBe('c');
      expect(queue.isEmpty()).toBe(true);
    });

    it('handles interleaved inserts and removes', () => {
      const queue = new BasicQueue();
      queue.insert('a');
      queue.insert('b');
      expect(queue.removeNext()).toBe('a');

      queue.insert('c');
      expect(queue.removeNext()).toBe('b');
      expect(queue.removeNext()).toBe('c');
      expect(queue.isEmpty()).toBe(true);
    });

    it('can be reused after being drained', () => {
      const queue = new BasicQueue();
      queue.insert('a');
      expect(queue.removeNext()).toBe('a');
      expect(queue.isEmpty()).toBe(true);

      queue.insert('b');
      expect(queue.isEmpty()).toBe(false);
      expect(queue.removeNext()).toBe('b');
    });

    it('preserves FIFO order across many items (compaction path)', () => {
      const queue = new BasicQueue();
      const count = 5000;
      for (let i = 0; i < count; i++) {
        queue.insert(`item${i}`);
      }

      const removed: string[] = [];
      let next: string | undefined;
      while ((next = queue.removeNext()) !== undefined) {
        removed.push(next);
      }

      expect(removed).toHaveLength(count);
      expect(removed[0]).toBe('item0');
      expect(removed[count - 1]).toBe(`item${count - 1}`);
      expect(queue.isEmpty()).toBe(true);
    });
  });
});
