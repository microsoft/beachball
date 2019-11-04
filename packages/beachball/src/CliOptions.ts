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
  fetch: boolean;
  yes: boolean;
  access: 'public' | 'restricted';
  package: string;
  changehint: string;
  type?: 'patch' | 'minor' | 'major' | 'prerelease' | null;
  version?: boolean;
}
