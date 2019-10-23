import { ChangeInfo, ChangeType, ChangeSet } from './ChangeInfo';
import { getChangedPackages } from './getChangedPackages';
import { getChangePath } from './paths';
import { getRecentCommitMessages, getUserEmail, getBranchName, getCurrentHash, stageAndCommit } from './git';
import fs from 'fs-extra';
import path from 'path';
import prompts from 'prompts';
import { getPackageInfos } from './monorepo';
import { prerelease } from 'semver';
import { CliOptions } from './CliOptions';
import { PackageInfo } from './PackageInfo';

/**
 * Uses `prompts` package to prompt for change type and description, fills in git user.email, scope, and the commit hash
 * @param cwd
 */
export async function promptForChange(options: CliOptions) {
  const { branch, path: cwd, package: specificPackage, fetch } = options;

  const changedPackages = specificPackage ? [specificPackage] : getChangedPackages(branch, cwd, fetch);
  const recentMessages = getRecentCommitMessages(branch, cwd) || [];
  const packageChangeInfo: { [pkgname: string]: ChangeInfo } = {};

  const packageInfos = getPackageInfos(cwd);

  for (let pkg of changedPackages) {
    console.log('');
    console.log(`Please describe the changes for: ${pkg}`);

    const showPrereleaseOption = prerelease(packageInfos[pkg].version);
    const changeTypePrompt: prompts.PromptObject<string> = {
      type: 'select',
      name: 'type',
      message: 'Change type',
      choices: [
        ...(showPrereleaseOption ? [{ value: 'prerelease', title: ' [1mPrerelease[22m - bump prerelease version' }] : []),
        { value: 'patch', title: ' [1mPatch[22m      - bug fixes; no backwards incompatible changes.' },
        { value: 'minor', title: ' [1mMinor[22m      - small feature; backwards compatible changes.' },
        { value: 'none', title: ' [1mNone[22m       - this change does not affect the published package in any way.' },
        { value: 'major', title: ' [1mMajor[22m      - major feature; breaking changes.' },
      ].filter(choice => !packageInfos[pkg].disallowedChangeTypes.includes(choice.value)),
    };

    if (changeTypePrompt.choices!.length === 0) {
      console.log('No valid changeTypes available, aborting');
      return;
    }

    if (options.type && packageInfos[pkg].disallowedChangeTypes.includes(options.type)) {
      console.log(`${options.type} type is not allowed, aborting`);
      return;
    }

    const descriptionPrompt: prompts.PromptObject<string> = {
      type: 'autocomplete',
      name: 'comment',
      message: 'Describe changes (type or choose one)',
      suggest: input => {
        return Promise.resolve([...recentMessages.filter(msg => msg.startsWith(input)), input]);
      },
    };

    const showChangeTypePrompt = !options.type && changeTypePrompt.choices!.length > 1;

    const questions = [
      ...(showChangeTypePrompt ? [changeTypePrompt] : []),
      ...(!options.message ? [descriptionPrompt] : []),
    ];

    let response: { comment: string; type: ChangeType } = {
      type: options.type || 'none',
      comment: options.message || '',
    };

    if (questions.length > 0) {
      response = (await prompts(questions)) as { comment: string; type: ChangeType };

      if (Object.keys(response).length === 0) {
        console.log('Cancelled, no change files are written');
        return;
      }
    }

    packageChangeInfo[pkg] = {
      ...response,
      packageName: pkg,
      email: getUserEmail(cwd) || 'email not defined',
      commit: getCurrentHash(cwd) || 'hash not available',
      date: new Date(),
    };
  }

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
    const changeFiles: string[] = [];

    Object.keys(changes).forEach(pkgName => {
      const suffix = branchName.replace(/[\/\\]/g, '-');
      const prefix = pkgName.replace(/[^a-zA-Z0-9@]/g, '-');
      const fileName = `${prefix}-${getTimeStamp()}-${suffix}.json`;
      let changeFile = path.join(changePath, fileName);

      if (fs.existsSync(changeFile)) {
        const nextFileName = `${prefix}-${getTimeStamp()}-${suffix}-${Math.random()
          .toString(36)
          .substr(2, 9)}.json`;
        changeFile = path.join(changePath, nextFileName);
      }

      const change = changes[pkgName];
      fs.writeFileSync(changeFile, JSON.stringify(change, null, 2));

      changeFiles.push(changeFile);
    });

    stageAndCommit(changeFiles, 'Change files', cwd);

    console.log(`git committed these change files:
${changeFiles.map(f => ` - ${f}`).join('\n')}
`);
  }
}

/**
 * Unlink only change files that are specified in the changes param
 *
 * @param changes existing change files to be removed
 * @param cwd
 */
export function unlinkChangeFiles(changeSet: ChangeSet, packageInfos: { [pkg: string]: PackageInfo }, cwd: string) {
  const changePath = getChangePath(cwd);

  if (!changePath || !changeSet) {
    return;
  }

  console.log('Removing change files:');
  for (let [changeFile, change] of changeSet) {
    if (changeFile && packageInfos[change.packageName] && !packageInfos[change.packageName].private) {
      console.log(`- ${changeFile}`);
      fs.removeSync(path.join(changePath, changeFile));
    }
  }

  if (fs.existsSync(changePath) && fs.readdirSync(changePath).length === 0) {
    console.log('Removing change path');
    fs.removeSync(changePath);
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
    leftPadTwoZeros(date.getSeconds().toString()),
  ].join('-');
}

export function readChangeFiles(cwd: string) {
  const changeSet: ChangeSet = new Map();
  const changePath = getChangePath(cwd);

  if (!changePath || !fs.existsSync(changePath)) {
    return changeSet;
  }

  const changeFiles = fs.readdirSync(changePath);

  changeFiles.forEach(changeFile => {
    try {
      const packageJson = JSON.parse(fs.readFileSync(path.join(changePath, changeFile)).toString());
      changeSet.set(changeFile, packageJson);
    } catch (e) {
      console.warn(`Invalid change file detected: ${changeFile}`);
    }
  });

  return changeSet;
}

export function getPackageChangeTypes(changeSet: ChangeSet) {
  const changeTypeWeights = {
    major: 4,
    minor: 3,
    patch: 2,
    prerelease: 1,
    none: 0,
  };
  const changePerPackage: { [pkgName: string]: ChangeInfo['type'] } = {};
  for (let [_, change] of changeSet) {
    const { packageName } = change;

    if (change.type === 'none') {
      continue;
    }

    if (
      !changePerPackage[packageName] ||
      changeTypeWeights[change.type] > changeTypeWeights[changePerPackage[packageName]]
    ) {
      changePerPackage[packageName] = change.type;
    }
  }

  return changePerPackage;
}
