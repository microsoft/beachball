import { expect } from '@jest/globals';
import { fail } from 'assert';
import { BeachballError } from '../types/BeachballError';

/**
 * Expects a promise or function to throw a BeachballError with a specific message.
 */
export async function expectBeachballError(
  promiseOrFunction: Promise<unknown> | (() => unknown | Promise<unknown>),
  expectedMessage: string | RegExp
): Promise<void> {
  try {
    if (typeof promiseOrFunction === 'function') {
      await promiseOrFunction();
    } else {
      await promiseOrFunction;
    }
    fail('should have thrown');
  } catch (err) {
    expect(err).toBeInstanceOf(BeachballError);
    expect((err as BeachballError).message).toMatch(expectedMessage);
  }
}
