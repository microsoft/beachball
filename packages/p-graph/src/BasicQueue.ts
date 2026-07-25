/**
 * A queue of node IDs that are "ready" to run (all their dependencies have completed).
 * Implementations decide the order in which ready nodes are handed back out.
 */
export interface IQueue {
  /** Add a node to the queue. */
  insert(id: string): void;

  /** Remove and return the next node to run, or `undefined` if the queue is empty. */
  removeNext(): string | undefined;

  /** Whether the queue currently has no ready nodes. */
  isEmpty(): boolean;
}

/**
 * A queue that returns ready nodes in the order they became ready (FIFO).
 */
export class BasicQueue implements IQueue {
  /** List of items, including already-removed ones before `#head` */
  #items: string[] = [];

  /** Index of the next item to remove (items before this have been consumed) */
  #head = 0;

  public insert(id: string): void {
    this.#items.push(id);
  }

  public removeNext(): string | undefined {
    if (this.#head >= this.#items.length) {
      return undefined;
    }

    const item = this.#items[this.#head];
    this.#head++;

    // Periodically reclaim consumed slots so the backing array doesn't grow unbounded
    if (this.#head > 1000 && this.#head * 2 >= this.#items.length) {
      this.#items = this.#items.slice(this.#head);
      this.#head = 0;
    }

    return item;
  }

  public isEmpty(): boolean {
    return this.#head >= this.#items.length;
  }
}
