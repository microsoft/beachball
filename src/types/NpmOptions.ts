import { BeachballOptions } from './BeachballOptions';

export type NpmOptions = Required<Pick<BeachballOptions, 'registry'>> &
  Partial<Pick<BeachballOptions, 'token' | 'authType' | 'access' | 'timeout' | 'verbose' | 'dryRun'>>;
