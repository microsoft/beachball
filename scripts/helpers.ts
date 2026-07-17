/** Log an ADO pipeline error and exit with a non-zero code. */
export function adoFail(message: string): never {
  console.log(`##vso[task.logissue type=error]${message}`);
  process.exit(1);
}

export function adoWarn(message: string): void {
  console.log(`##vso[task.logissue type=warning]${message}`);
}
