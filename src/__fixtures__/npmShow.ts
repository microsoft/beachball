import { expect } from '@jest/globals';
import os from 'os';
import { env } from '../env';
import type { NpmShowResult } from '../packageManager/listPackageVersions';
import { npm } from '../packageManager/npm';
import type { Registry } from './registry';

/**
 * Runs `npm show <packageName>` on the fake registry and returns the result.
 * Also does an `expect()` to verify whether the command was successful
 * (or unsuccessful if `shouldFail` is true).
 */
export async function npmShow(
  packageName: string,
  options: { registry?: Registry; shouldFail?: boolean } = {}
): Promise<NpmShowResult | undefined> {
  const { registry, shouldFail } = options;

  const timeout = env.isCI && os.platform() === 'win32' ? 8000 : 4000;
  const registryArg = registry ? ['--registry', registry.getUrl()] : [];

  const showResult = await npm([...registryArg, 'show', '--json', packageName], { timeout, cwd: undefined });

  expect(!!showResult.timedOut).toBe(false);
  expect(showResult.failed).toBe(!!shouldFail);

  return shouldFail ? undefined : (JSON.parse(showResult.stdout) as NpmShowResult);
}
