import { ChangeType } from './ChangeInfo';

export type BeachballOptions = CliOptions & RepoOptions & PackageOptions;

export interface CliOptions {
  branch: string;
  command: string;
  message: string;
  path: string;
  registry: string;
  tag: string;
  token: string;
  push: boolean;
  publish: boolean;
  bumpDeps: boolean;
  fetch: boolean;
  yes: boolean;
  access: 'public' | 'restricted';
  package: string;
  changehint: string;
  type?: ChangeType | null;
  help?: boolean;
  version?: boolean;
}

export interface RepoOptions {
  branch: string;
  message: string;
  path: string;
  registry: string;
  tag: string;
  push: boolean;
  publish: boolean;
  bumpDeps: boolean;
  fetch: boolean;
  access: 'public' | 'restricted';
  changehint: string;
  disallowedChangeTypes: ChangeType[] | null;
  defaultNpmTag: string;
}

export interface PackageOptions {
  disallowedChangeTypes: ChangeType[] | null;
  defaultNpmTag: string;
}
