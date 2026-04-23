//
// This script MUST NOT USE EXTERNAL DEPENDENCIES!
// It's run before `yarn install` in .ado/publish.yml to use a private registry for compliance.
//

const fs = require('fs');
const path = require('path');

const repoRoot = path.dirname(__dirname);
const publishNpmrcPath = path.join(repoRoot, '.npmrc.publish');
const npmrcPath = path.join(repoRoot, '.npmrc');
const lockPath = path.join(repoRoot, 'yarn.lock');

fs.copyFileSync(publishNpmrcPath, npmrcPath);
console.log(`Copied ${publishNpmrcPath} to ${npmrcPath}`);

const npmrcRegistry = fs
  .readFileSync(publishNpmrcPath, 'utf-8')
  .split(/\r?\n/g)
  .find(line => line.startsWith('registry='))
  ?.replace(/^registry="?([^"]+).*/, '$1');

if (npmrcRegistry) {
  console.log(`Using npm registry: ${npmrcRegistry}`);
} else {
  console.warn(`No registry found in ${publishNpmrcPath}`);
  process.exit(1);
}

const yarnLockContent = fs.readFileSync(lockPath, 'utf-8');
const updatedYarnLockContent = yarnLockContent.replace(
  /https:\/\/registry.yarnpkg.com\//g,
  npmrcRegistry.endsWith('/') ? npmrcRegistry : `${npmrcRegistry}/`
);
fs.writeFileSync(lockPath, updatedYarnLockContent);
console.log(`Updated registry in yarn.lock to ${npmrcRegistry}`);
