import { expect } from '@jest/globals';
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
  const showResult = npm(['--registry', registry.getUrl(), 'show', packageName, '--json'], { timeout: 1000 });
  expect(showResult.failed).toBe(shouldFail);
  return shouldFail ? undefined : JSON.parse(showResult.stdout);
}
