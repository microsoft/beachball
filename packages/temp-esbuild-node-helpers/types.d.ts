export type PackageJsonPerson =
  | string
  | {
      name: string;
      email?: string;
      url?: string;
    };
export interface PackageJson {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  exports?: unknown;
  files?: string[];
  bin?: string | Record<string, string>;
  types?: string;
  author?: PackageJsonPerson;
  contributors?: PackageJsonPerson[];
  maintainers?: PackageJsonPerson[];
  homepage?: string;
  license?: string;
  repository?:
    | string
    | {
        type: string;
        url: string;
      };
}
//# sourceMappingURL=types.d.ts.map
