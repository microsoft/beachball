import { jest } from '@jest/globals';
import type { CliContext } from '../types.ts';

/** Get a context which mocks all functions and throws on `exitOverride` */
export function getContext(args: string[], env: NodeJS.ProcessEnv = {}): jest.Mocked<Required<CliContext>> {
  return {
    argv: ['node', 'proper-changelog.js', ...args],
    env,
    log: jest.fn(),
    warn: jest.fn(),
    writeFile: jest.fn(),
    writeErr: jest.fn(),
    exitOverride: jest.fn(err => {
      throw err;
    }),
  };
}
