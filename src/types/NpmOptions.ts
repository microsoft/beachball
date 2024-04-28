import { BeachballOptions } from './BeachballOptions';

export type NpmOptions = Required<Pick<BeachballOptions, 'registry'>> & { path: string | undefined } & Partial<
    Pick<BeachballOptions, 'token' | 'authType' | 'access' | 'timeout' | 'verbose'>
  >;
