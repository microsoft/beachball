import type { PGraphNodeMap } from '../types';

interface MockFunctionDefinition {
  /** A friendly name for the function */
  name: string;

  /** How many ticks this function should take to simulate the duration of the function execution */
  duration: number;

  /** Priority value to pass to the PGraphNode that is created */
  priority?: number;
}

/** A record of a function start or end event that can be composed to create an ordered log of function calls **/
interface MockFunctionCallRecord {
  /** The name of the function */
  name: string;

  /** Denotes if this is when the function started or ended execution */
  state: 'start' | 'end';
}

/**
 * Schedules task functions to run in "ticks" to verify concurrency without relying on timeouts
 * or fake timers.
 */
export class FunctionScheduler {
  readonly #callRecords: MockFunctionCallRecord[] = [];

  /** Node map which can be passed to `PGraph` */
  public readonly nodeMap: PGraphNodeMap = new Map();

  #currentlyRunningFunctions: Array<{
    name: string;
    ticksRemaining: number;
    resolve: () => void;
  }> = [];

  #tickScheduled: boolean = false;

  /**
   * Add a node to `this.nodeMap`, which can be passed to `PGraph`.
   * The node will have a `run` function that runs for a given number of ticks and records
   * the run in `this.callRecords`.
   */
  public addNode(definition: MockFunctionDefinition): void {
    this.nodeMap.set(definition.name, {
      run: () => this.#runFunction(definition),
      priority: definition.priority,
    });
  }

  /** Get the max concurrency observed from the call records */
  public getMaxConcurrency(): number {
    let current = 0;
    let max = 0;

    for (const record of this.#callRecords) {
      current += record.state === 'start' ? 1 : -1;
      max = Math.max(current, max);
    }

    return max;
  }

  /**
   * Verify that `secondTaskName` was only scheduled after `firstTaskName` completed
   */
  public hasScheduleOrdering(firstTaskName: string, secondTaskName: string): boolean {
    const firstIndex = this.#callRecords.findIndex(item => item.name === firstTaskName && item.state === 'end');
    const secondIndex = this.#callRecords.findIndex(item => item.name === secondTaskName && item.state === 'start');

    return firstIndex !== -1 && secondIndex !== -1 && firstIndex < secondIndex;
  }

  /**
   * Verify that `secondTaskName` was started after `firstTaskName` started
   */
  public didStartBefore(firstTaskName: string, secondTaskName: string): boolean {
    const firstIndex = this.#callRecords.findIndex(item => item.name === firstTaskName && item.state === 'start');
    const secondIndex = this.#callRecords.findIndex(item => item.name === secondTaskName && item.state === 'start');

    return firstIndex !== -1 && secondIndex !== -1 && firstIndex < secondIndex;
  }

  /**
   * Verify that `taskName` was completed (started and ended).
   */
  public didCompleteTask(taskName: string): boolean {
    return (
      this.#callRecords.some(item => item.name === taskName && item.state === 'start') &&
      this.#callRecords.some(item => item.name === taskName && item.state === 'end')
    );
  }

  #runFunction(definition: MockFunctionDefinition): Promise<void> {
    const { name, duration } = definition;
    this.#callRecords.push({ name, state: 'start' });

    const promise = new Promise<void>(resolve => {
      this.#currentlyRunningFunctions.push({ name, ticksRemaining: duration, resolve });
    });

    this.#ensureTickScheduled();

    return promise;
  }

  #ensureTickScheduled() {
    if (this.#tickScheduled) return;

    this.#tickScheduled = true;
    void Promise.resolve().then(() => this.#tick());
  }

  #tick() {
    this.#tickScheduled = false;
    for (const item of this.#currentlyRunningFunctions) {
      item.ticksRemaining--;
    }

    const finishedItems = this.#currentlyRunningFunctions.filter(item => item.ticksRemaining === 0);
    this.#currentlyRunningFunctions = this.#currentlyRunningFunctions.filter(item => item.ticksRemaining !== 0);

    for (const item of finishedItems) {
      item.resolve();
      this.#callRecords.push({ name: item.name, state: 'end' });
    }

    if (this.#currentlyRunningFunctions.length > 0) {
      this.#ensureTickScheduled();
    }
  }
}
