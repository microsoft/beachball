//
// This script MUST NOT USE EXTERNAL DEPENDENCIES!
// It's run before `yarn install` in .ado/publish.yml to use a private registry for compliance.
//

import fs from 'fs';
import path from 'path';

const repoRoot = path.dirname(import.meta.dirname);
const publishNpmrcPath = path.join(repoRoot, '.npmrc.publish');
const npmrcPath = path.join(repoRoot, '.npmrc');
const yarnrcPath = path.join(repoRoot, '.yarnrc.yml');

fs.copyFileSync(publishNpmrcPath, npmrcPath);
console.log(`Copied ${publishNpmrcPath} to ${npmrcPath}`);

const npmrcRegistry = fs
  .readFileSync(publishNpmrcPath, 'utf-8')
  .split(/\r?\n/g)
  .find((line: string) => line.startsWith('registry='))
  ?.replace(/^registry="?([^"]+).*/, '$1');

if (!npmrcRegistry) {
  console.error(`No registry found in ${publishNpmrcPath}`);
  process.exit(1);
}

const yarnrcUpdates = `
npmRegistryServer: "${npmrcRegistry}"
npmAlwaysAuth: true
npmrcAuthEnabled: true
`;
console.log(`Updating ${yarnrcPath} with private registry settings:\n${yarnrcUpdates}`);
const yarnrcContent = fs.readFileSync(yarnrcPath, 'utf-8');
fs.writeFileSync(yarnrcPath, `${yarnrcContent}\n${yarnrcUpdates}`, 'utf-8');
