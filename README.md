# p-graph

Run a promise graph with concurrency control.

## Install

```
$ npm install p-graph
```

`p-graph` does not have a strict Node version requirement, but the syntax used is currently intended to remain compatible with Node 12+.

## Usage

The p-graph library takes in a map of of nodes and a list of dependencies. The keys in the map are unique string identifiers for each node in the graph. The value of the map is the definition of the task, including the function that should be executed by that task in it's run argument. The dependencies list is an array of tuples, each tuple contains the two values that must correspond to ids in the node map. The run function corresponding to the first item in the tuple must complete before the second item in the tuple can begin.

The return value of pGraph is a class with a `run()` function. Calling the `run()` function will return a promise that resolves after all the tasks in the graph have finished completed. Tasks are run in dependency order.

```ts
import { pGraph, type DependencyList, type PGraphNodeRecord } from "p-graph";

// This can be either an object or map (PGraphNodeMap).
// Functions can be sync or async.
const nodeMap: PGraphNodeRecord = {
  putOnShirt: { run: () => console.log("put on your shirt") },
  putOnShorts: { run: () => console.log("put on your shorts") },
  putOnJacket: { run: () => console.log("put on your jacket") },
  putOnShoes: { run: () => console.log("put on your shoes") },
  tieShoes: { run: () => console.log("tie your shoes") },
};

const dependencies: DependencyList = [
  // You need to put your shoes on before you tie them!
  ["putOnShoes", "tieShoes"],
  ["putOnShirt", "putOnJacket"],
  ["putOnShorts", "putOnJacket"],
  ["putOnShorts", "putOnShoes"],
];

await pGraph(nodeMap, dependencies).run();
```

### Concurrency

There are some contexts where you may want to limit the number of functions running concurrently. One example would be to prevent overloading the CPU with too many parallel tasks. The concurrency argument to `run` will limit the number of functions that start running at a given time. If no concurrency option is set, the concurrency is not limited and tasks are run as soon as they are unblocked.

```js
await pGraph(graph).run({ concurrency: 3 });
```

### Priority

By default, tasks are considered to all be equally important, so they're equally likely to be picked to run once all the tasks they depend on are complete. To control the ordering of tasks, use the `priority` option when defining a task node. Tasks will always execute in dependency order, but unblocked tasks with a higher priority will be favored over those with a lower priority.

```js
const nodeMap: PGraphNodeRecord = {
  highPri: { run: () => Promise.resolve(), priority: 10 },
  lowPri: { run: () => Promise.resolve(), priority: 1 },
  unspecified: { run: () => Promise.resolve() } // treated as 0
}
```
