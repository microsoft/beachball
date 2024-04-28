import { PackageManagerResult, packageManager } from './packageManager';

// The npm wrapper for packageManager is preserved for convenience.

export type NpmResult = PackageManagerResult;

/**
 * Run an npm command. Returns the error result instead of throwing on failure.
 */
export const npm = packageManager.bind(null, 'npm');
