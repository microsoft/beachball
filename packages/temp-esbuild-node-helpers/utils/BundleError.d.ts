/**
 * Thrown by `bundleNode`. Check the `alreadyLogged` property to see if the message
 * has already been logged to the console.
 */
export declare class BundleError extends Error {
  readonly alreadyLogged: boolean;
  constructor(
    message: string,
    options?: ErrorOptions & {
      alreadyLogged?: boolean;
    }
  );
}
//# sourceMappingURL=BundleError.d.ts.map
