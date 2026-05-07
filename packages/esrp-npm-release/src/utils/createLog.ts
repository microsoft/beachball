/** Create a function that logs to console.log with a prefix */
export function createLog(prefix: string): (...args: unknown[]) => void {
  return (...args: unknown[]) => {
    console.log(`[${prefix}]`, ...args);
  };
}
