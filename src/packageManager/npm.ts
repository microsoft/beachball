import { spawn, type SpawnResult } from '../process/spawn';

// The npm wrapper for packageManager is preserved for convenience.
// It also makes mocking easier in tests (to mock npm but not git).

export type NpmResult = SpawnResult;

/**
 * Run an npm command. Returns the error result instead of throwing on failure.
 */
export const npm = spawn.bind(null, 'npm');
