import { expect } from '@jest/globals';
import os from 'os';
import { npm } from '../packageManager/npm';
import { Registry } from './registry';

/** Partial JSON returned by registry from running `npm show` */
export type NpmShowResult = {
  name: string;
  versions: string[];
  main?: string;
  'dist-tags': Record<string, string>;
};

/**
 * Runs `npm show <packageName>` on the fake registry and returns the result.
 * Also does an `expect()` to verify whether the command was successful
 * (or unsuccessful if `shouldFail` is true).
 */
export function npmShow(
  registry: Registry,
  packageName: string,
  shouldFail: boolean = false
): NpmShowResult | undefined {
  const timeout = process.env.CI && os.platform() === 'win32' ? 3000 : 1000;
  const start = Date.now();
  const showResult = npm(['--registry', registry.getUrl(), 'show', packageName, '--json'], { timeout });
  if (Date.now() - start > timeout) {
    throw new Error(`npm show ${packageName} took more than ${timeout}ms`);
  }
  expect(showResult.failed).toBe(shouldFail);
  return shouldFail ? undefined : JSON.parse(showResult.stdout);
}
