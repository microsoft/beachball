import { expect } from '@jest/globals';
import os from 'os';
import { env } from '../env';
import { NpmShowResult } from '../packageManager/listPackageVersions';
import { npm } from '../packageManager/npm';
import { Registry } from './registry';

/**
 * Runs `npm show <packageName>` on the fake registry and returns the result.
 * Also does an `expect()` to verify whether the command was successful
 * (or unsuccessful if `shouldFail` is true).
 */
export async function npmShow(
  packageName: string,
  options: { registry: Registry; shouldFail?: boolean }
): Promise<NpmShowResult | undefined> {
  const { registry, shouldFail } = options;

  const timeout = env.isCI && os.platform() === 'win32' ? 4500 : 1500;
  const registryArg = registry ? ['--registry', registry.getUrl()] : [];

  const showResult = await npm([...registryArg, 'show', '--json', packageName], { timeout });

  expect(!!showResult.timedOut).toBe(false);
  expect(showResult.failed).toBe(!!shouldFail);

  return shouldFail ? undefined : JSON.parse(showResult.stdout);
}
