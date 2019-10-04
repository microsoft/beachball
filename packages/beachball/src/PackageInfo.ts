export interface PackageInfo {
  name: string;
  packageJsonPath: string;
  version: string;
  dependencies?: { [dep: string]: string };
  devDependencies?: { [dep: string]: string };
  disallowedChangeTypes: string[];
  defaultNpmTag: string;
  private: boolean;
}
