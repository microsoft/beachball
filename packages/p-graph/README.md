# p-graph

Run a promise graph with concurrency control.

## Install

```
$ npm install p-graph
```

## Usage

The `PGraph` class takes in a map (or record) of nodes and a list of dependencies.

```ts
import { PGraph, type DependencyList, type PGraphNodeRecord } from 'p-graph';

// Mapping from node IDs to definitions (can be either an object or map).
// `run` functions can be sync or async. Nodes can optionally define a `priority`.
// (Alternatively, you can omit the `run` functions here and specify a single
// function to `pGraph.run()`.)
const nodeMap: PGraphNodeRecord = {
  putOnShirt: { run: () => console.log('put on your shirt') },
  putOnShorts: { run: () => console.log('put on your shorts') },
  putOnJacket: { run: () => console.log('put on your jacket') },
  putOnShoes: { run: () => console.log('put on your shoes') },
  tieShoes: { run: () => console.log('tie your shoes') },
};

// List of tuples describing dependencies (edges) between node IDs:
// the first task must complete before the second one begins.
const dependencies: DependencyList = [
  // You need to put your shoes on before you tie them!
  ['putOnShoes', 'tieShoes'],
  ['putOnShirt', 'putOnJacket'],
  ['putOnShorts', 'putOnJacket'],
  ['putOnShorts', 'putOnShoes'],
];

// Run the tasks (log to console) in dependency order
await new PGraph(nodeMap, dependencies).run();

// Alternative API: reuse a single run() function
const simpleNodeMap: PGraphNodeRecord = {
  putOnShirt: {},
  putOnShorts: {},
  putOnJacket: {},
  putOnShoes: {},
  tieShoes: {},
};
await new PGraph(simpleNodeMap, dependencies).run({
  run: taskId => console.log(taskId),
});
```

If a task fails, the graph will throw a `PGraphError` wrapping the original error(s). See `run()` comments for more details.

### Concurrency

There are some contexts where you may want to limit the number of functions running concurrently. One example would be to prevent overloading the CPU with too many parallel tasks. The `concurrency` argument to `run` will limit the number of functions that start running at a given time. If no `concurrency` option is set, the concurrency is not limited and tasks are run as soon as they are unblocked.

```js
await pGraph(graph).run({ concurrency: 3 });
```

### Priority

By default, all tasks are considered to be equally important, so they're equally likely to be picked to run once the tasks they depend on are complete. To control the ordering of tasks, use the `priority` option when defining a task node. Tasks will always execute in dependency order, but unblocked tasks with a higher priority will be favored over those with a lower priority.

```js
const nodeMap: PGraphNodeRecord = {
  highPri: { run: () => Promise.resolve(), priority: 10 },
  lowPri: { run: () => Promise.resolve(), priority: 1 },
  unspecified: { run: () => Promise.resolve() } // treated as 0
}
```

## Breaking changes in v2

- The default export function and the `pGraph` function have been removed. Use `new PGraph()` instead.
- If a task fails, `run()` will reject with a single `PGraphError` instead of an array of errors. The original errors are available under `pGraphError.errors`. (Note a regular `Error` may also be thrown if initial validation fails. `PGraphError` is exported for `instanceof` checks.)
