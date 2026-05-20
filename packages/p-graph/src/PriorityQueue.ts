interface PriorityQueueItem<T> {
  item: T;
  priority: number;
}

export class PriorityQueue<T> {
  /** @internal public for testing */
  public readonly array: PriorityQueueItem<T>[] = [];

  public isEmpty(): boolean {
    return this.array.length === 0;
  }

  public insert(item: T, priority: number): void {
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

  public removeMax(): T | undefined {
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
