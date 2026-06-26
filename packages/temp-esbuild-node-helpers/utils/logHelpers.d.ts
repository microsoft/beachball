/** picocolors instance that's disabled in jest */
export declare const colors: import('picocolors/types.js').Colors;
/**
 * Log an error, with a special error prefix if running in github or ADO.
 *
 * If `message` is an Error object, it will log the stack.
 */
export declare function logError(message: unknown): void;
/**
 * Format a nested bulleted list.
 */
export type BulletList = (string | undefined | BulletList)[];
export declare function bulletedList(lines: BulletList, indent?: number): string;
//# sourceMappingURL=logHelpers.d.ts.map
