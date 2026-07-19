import type { BeachballOptions } from './BeachballOptions';

export type NpmOptions = Required<Pick<BeachballOptions, 'npmReadConcurrency' | 'path'>> &
  Partial<
    Pick<
      BeachballOptions,
      'registry' | 'token' | 'authType' | 'access' | 'timeout' | 'verbose' | 'tag' | 'defaultNpmTag'
    >
  >;
