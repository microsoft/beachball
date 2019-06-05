import { ChangeInfo } from './ChangeInfo';
import { getChangedPackages } from './getChangedPackages';
import { getChangePath } from './paths';
import { getRecentCommitMessages, getUserEmail, getBranchName, getCurrentHash } from './git';
import fs from 'fs-extra';
import path from 'path';
import prompts from 'prompts';

/**
 * Uses `prompts` package to prompt for change type and description, fills in git user.email, scope, and the commit hash
 * @param cwd
 */
export async function promptForChange(cwd?: string) {
  const changedPackages = getChangedPackages(cwd);
  const recentMessages = getRecentCommitMessages(cwd) || [];
  const packageChangeInfo: { [pkgname: string]: ChangeInfo } = {};

  await changedPackages.reduce(async (currentPromise, pkg) => {
    await currentPromise;

    console.log('');
    console.log(`Please describe the changes for: ${pkg}`);

    const response = await prompts([
      {
        type: 'autocomplete',
        name: 'description',
        message: 'Describe changes (type or choose one)',
        suggest: input => {
          return Promise.resolve([...recentMessages.filter(msg => msg.startsWith(input)), input]);
        }
      },
      {
        type: 'select',
        name: 'type',
        message: 'Change type',
        choices: [
          { value: 'patch', title: 'Patch - bug fixes; no backwards incompatible changes.' },
          { value: 'minor', title: 'Minor - small feature; backwards compatible changes.' },
          { value: 'none', title: 'None - this change does not affect the published package in any way.' },
          { value: 'major', title: 'Major - major feature; breaking changes.' }
        ]
      }
    ]);

    packageChangeInfo[pkg] = {
      ...response,
      packageName: pkg,
      email: getUserEmail(cwd) || 'email not defined',
      hash: getCurrentHash(cwd) || 'hash not available'
    };
  }, Promise.resolve());

  return packageChangeInfo;
}

/**
 * Loops through the `changes` and writes out a list of change files
 * @param changes
 * @param cwd
 */
export function writeChangeFiles(changes: { [pkgname: string]: ChangeInfo }, cwd?: string) {
  const changePath = getChangePath(cwd);
  const branchName = getBranchName(cwd);

  if (changePath && !fs.existsSync(changePath)) {
    fs.mkdirpSync(changePath);
  }

  if (changes && branchName && changePath) {
    Object.keys(changes).forEach(pkgName => {
      const suffix = branchName.replace(/[\/\\]/g, '-');
      const prefix = pkgName.replace(/[^a-zA-Z0-9@]/g, '-');
      const fileName = `${prefix}-${getTimeStamp()}-${suffix}.json`;
      const changeFile = path.join(changePath, fileName);
      const change = changes[pkgName];
      fs.writeFileSync(changeFile, JSON.stringify(change, null, 2));
    });
  }
}

function leftPadTwoZeros(someString: string) {
  return ('00' + someString).slice(-2);
}

function getTimeStamp() {
  let date = new Date();
  return [
    date.getFullYear(),
    leftPadTwoZeros((date.getMonth() + 1).toString()),
    leftPadTwoZeros(date.getDate().toString()),
    leftPadTwoZeros(date.getHours().toString()),
    leftPadTwoZeros(date.getMinutes().toString()),
    leftPadTwoZeros(date.getSeconds().toString())
  ].join('-');
}
