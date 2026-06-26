/**
 * Thrown by `bundleNode`. Check the `alreadyLogged` property to see if the message
 * has already been logged to the console.
 */
export class BundleError extends Error {
  alreadyLogged;
  constructor(message, options) {
    super(message, { cause: options?.cause });
    this.alreadyLogged = !!options?.alreadyLogged;
  }
}
//# sourceMappingURL=BundleError.js.map
