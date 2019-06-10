import { ChangeInfo } from './ChangeInfo';
import { getChangedPackages } from './getChangedPackages';
import { getChangePath } from './paths';
import { getRecentCommitMessages, getUserEmail, getBranchName, getCurrentHash, stageAndCommit } from './git';
import fs from 'fs-extra';
import path from 'path';
import prompts from 'prompts';

/**
 * Uses `prompts` package to prompt for change type and description, fills in git user.email, scope, and the commit hash
 * @param cwd
 */
export async function promptForChange(branch: string, cwd: string) {
  const changedPackages = getChangedPackages(branch, cwd);
  const recentMessages = getRecentCommitMessages(branch, cwd) || [];
  const packageChangeInfo: { [pkgname: string]: ChangeInfo } = {};

  await changedPackages.reduce(async (currentPromise, pkg) => {
    await currentPromise;

    console.log('');
    console.log(`Please describe the changes for: ${pkg}`);

    const response = await prompts([
      {
        type: 'autocomplete',
        name: 'comment',
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

    if (Object.keys(response).length === 0) {
      console.log('Cancelled, no change files are written');
      return;
    }

    packageChangeInfo[pkg] = {
      ...response,
      packageName: pkg,
      email: getUserEmail(cwd) || 'email not defined',
      commit: getCurrentHash(cwd) || 'hash not available',
      date: new Date()
    };
  }, Promise.resolve());

  return packageChangeInfo;
}

/**
 * Loops through the `changes` and writes out a list of change files
 * @param changes
 * @param cwd
 */
export function writeChangeFiles(changes: { [pkgname: string]: ChangeInfo }, cwd: string) {
  if (Object.keys(changes).length === 0) {
    return;
  }

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

    stageAndCommit([path.join(changePath, '*.json')], 'Change files', cwd);
  }
}

export function unlinkChangeFiles(cwd: string) {
  const changePath = getChangePath(cwd);

  if (!changePath) {
    return;
  }

  fs.removeSync(changePath);
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

export function readChangeFiles(cwd: string) {
  const changePath = getChangePath(cwd);

  if (!changePath || !fs.existsSync(changePath)) {
    return [];
  }

  const changeFiles = fs.readdirSync(changePath);
  const changes: ChangeInfo[] = [];

  changeFiles.forEach(changeFile => {
    try {
      changes.push(JSON.parse(fs.readFileSync(path.join(changePath, changeFile)).toString()));
    } catch (e) {
      console.warn(`Invalid change file detected: ${changeFile}`);
    }
  });

  return changes;
}

export function getPackageChangeTypes(cwd: string) {
  const changeTypeWeights = {
    major: 3,
    minor: 2,
    patch: 1,
    none: 0
  };
  const changes = readChangeFiles(cwd);
  const changePerPackage: { [pkgName: string]: ChangeInfo['type'] } = {};
  changes.forEach(change => {
    const { packageName } = change;

    if (
      !changePerPackage[packageName] ||
      (change.type !== 'none' && changeTypeWeights[change.type] > changeTypeWeights[changePerPackage[packageName]])
    ) {
      changePerPackage[packageName] = change.type;
    }
  });

  return changePerPackage;
}
