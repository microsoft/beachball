import type { IQueue } from './BasicQueue';

interface PriorityQueueItem {
  item: string;
  priority: number;
}

export class PriorityQueue implements IQueue {
  /** @internal public for testing */
  public readonly array: PriorityQueueItem[] = [];
  readonly #priorities?: Record<string, number>;

  public constructor(priorities?: Record<string, number>) {
    this.#priorities = priorities;
  }

  public isEmpty(): boolean {
    return this.array.length === 0;
  }

  /**
   * Insert an item in priority order.
   * If `priority` is not provided, it must exist in the `priorities` passed to the constructor.
   */
  public insert(item: string, priority?: number): void {
    priority ??= this.#priorities?.[item];
    if (priority === undefined) {
      throw new Error(`Priorities were specified upfront, but "${item}" is missing a priority`);
    }

    this.array.push({ item, priority });

    // Heapify up
    let indexToCheck = this.array.length - 1;
    while (indexToCheck > 0) {
      const parentIndex = Math.floor((indexToCheck - 1) / 2);

      if (this.array[indexToCheck].priority > this.array[parentIndex].priority) {
        this.#swap(indexToCheck, parentIndex);
        indexToCheck = parentIndex;
      } else {
        break;
      }
    }
  }

  /** Remove the max priority element. */
  public removeNext(): string | undefined {
    if (this.array.length === 0) {
      return undefined;
    }

    const max = this.array[0];

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- verified above
    const last = this.array.pop()!;
    if (this.array.length > 0) {
      this.array[0] = last;
      this.#heapifyDown();
    }

    return max.item;
  }

  #heapifyDown(): void {
    let index = 0;

    while (true) {
      const leftIndex = 2 * index + 1;
      const rightIndex = 2 * index + 2;
      let largest = index;

      if (leftIndex < this.array.length && this.array[leftIndex].priority > this.array[largest].priority) {
        largest = leftIndex;
      }

      if (rightIndex < this.array.length && this.array[rightIndex].priority > this.array[largest].priority) {
        largest = rightIndex;
      }

      if (largest !== index) {
        this.#swap(index, largest);
        index = largest;
      } else {
        break;
      }
    }
  }

  #swap(i: number, j: number): void {
    const temp = this.array[i];
    this.array[i] = this.array[j];
    this.array[j] = temp;
  }
}
