import type { Dependency } from './types.ts';
export declare const noticeFilename = "NOTICE.txt";
/**
 * Write NOTICE.txt with license and author info for the given dependencies.
 */
export declare function writeNotice(dependencies: Dependency[], absOutDir: string, excludeFromNotice?: (dependency: Dependency) => boolean): void;
//# sourceMappingURL=writeNotice.d.ts.map