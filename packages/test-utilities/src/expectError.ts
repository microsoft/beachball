import { expect } from '@jest/globals';
import { fail } from 'node:assert';

/**
 * Expects a promise or function to throw an `errorType` with a specific message.
 */
export async function expectError(
  promiseOrFunction: Promise<unknown> | (() => Promise<unknown>),
  errorType: unknown,
  expectedMessage: string | RegExp | (string | RegExp)[],
  expectedCause?: unknown
): Promise<unknown> {
  try {
    if (typeof promiseOrFunction === 'function') {
      await promiseOrFunction();
    } else {
      await promiseOrFunction;
    }
    fail('should have thrown');
  } catch (err) {
    checkError(err, errorType, expectedMessage, expectedCause);
    return err;
  }
}

/**
 * Expects a function to throw an `errorType` with a specific message.
 */
export function expectErrorSync(
  fn: () => unknown,
  errorType: unknown,
  expectedMessage: string | RegExp | (string | RegExp)[],
  expectedCause?: unknown
): unknown {
  try {
    fn();
    fail('should have thrown');
  } catch (err) {
    checkError(err, errorType, expectedMessage, expectedCause);
    return err;
  }
}

function checkError(
  err: unknown,
  errorType: unknown,
  expectedMessage: string | RegExp | (string | RegExp)[],
  expectedCause?: unknown
) {
  expect(err).toBeInstanceOf(errorType);
  if (Array.isArray(expectedMessage)) {
    for (const msg of expectedMessage) {
      expect((err as Error).message).toMatch(msg);
    }
  } else {
    expect((err as Error).message).toMatch(expectedMessage);
  }
  if (expectedCause) {
    if (expectedCause instanceof Error) {
      expect((err as Error).cause).toBe(expectedCause);
    } else if (typeof expectedCause === 'string' || expectedCause instanceof RegExp) {
      expect((err as Error).cause).toBeInstanceOf(Error);
      expect(((err as Error).cause as Error).message).toMatch(expectedCause);
    } else {
      throw new Error('expectedCause must be an Error, string, or RegExp');
    }
  }
}
