import type { BeachballOptions } from './BeachballOptions';

export type NpmOptions = Required<Pick<BeachballOptions, 'registry' | 'npmReadConcurrency' | 'path'>> &
  Partial<Pick<BeachballOptions, 'token' | 'authType' | 'access' | 'timeout' | 'verbose' | 'tag' | 'defaultNpmTag'>>;
