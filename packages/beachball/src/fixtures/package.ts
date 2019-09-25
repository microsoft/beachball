import fs from 'fs';
import path from 'path';
import * as tmp from 'tmp';
import { PackageInfo } from '../monorepo';

export const testTag = 'testbeachballtag';

const testPackage = {
  name: "testbeachballpackage",
  version: "0.6.0"
};

// Create a test package.json in a temporary location for use in tests.
var tmpPackageFile = path.join(tmp.dirSync().name, 'package.json')

var testPackageJson = JSON.stringify(testPackage);
fs.writeFileSync(tmpPackageFile, testPackageJson, 'utf8');

export const testPackageInfo: PackageInfo = {
  name: testPackage.name,
  packageJsonPath: tmpPackageFile,
  defaultNpmTag: 'latest',
  version: testPackage.version,
  disallowedChangeTypes: [],
  private: false
};
