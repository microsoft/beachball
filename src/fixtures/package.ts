import fs from 'fs-extra';
import path from 'path';
import * as tmp from 'tmp';
import { PackageInfo } from '../types/PackageInfo';

export const testTag = 'testbeachballtag';

const testPackage = {
  name: 'testbeachballpackage',
  version: '0.6.0',
};

// Create a test package.json in a temporary location for use in tests.
var tmpPackageFile = path.join(tmp.dirSync().name, 'package.json');

fs.writeJSONSync(tmpPackageFile, testPackage, { spaces: 2 });

export const testPackageInfo: PackageInfo = {
  name: testPackage.name,
  packageJsonPath: tmpPackageFile,
  version: testPackage.version,
  private: false,
  options: {
    gitTags: true,
    defaultNpmTag: 'latest',
    disallowedChangeTypes: [],
  },
};
