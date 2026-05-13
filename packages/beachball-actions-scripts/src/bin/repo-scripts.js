#!/usr/bin/env node

const [taskName, ...taskArgs] = process.argv.slice(2);

async function startTask() {
  /** @type {{ default: (args: string[]) => Promise<unknown> }} */
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- jsdoc not detected
  const taskModule = await import(`../tasks/${taskName}.js`);
  await taskModule.default(taskArgs);
}

startTask().catch((/** @type {Error} */ err) => {
  console.error(err.stack || err);
  process.exit(1);
});
