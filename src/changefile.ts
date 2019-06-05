import prompts from 'prompts';
import { getRecentCommitMessages, getUserEmail, getChanges, getBranchName, getCurrentHash } from './git';
import fs from 'fs-extra';
import path from 'path';
import { getChangePath, findPackageRoot } from './paths';
import { findLernaConfig, getPackagePatterns } from './monorepo';
import minimatch from 'minimatch';

interface ChangeInfo {
  type: 'patch' | 'minor' | 'major' | 'none';
  description: string;
}

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

    packageChangeInfo[pkg] = response;
  }, Promise.resolve());

  return packageChangeInfo;
}

function getChangedPackages(cwd?: string) {
  const changes = getChanges(cwd);

  const packageRoots: { [pathName: string]: string } = {};

  if (changes) {
    // Discover package roots from modded files
    changes.forEach(moddedFile => {
      const root = findPackageRoot(path.join(cwd || process.cwd(), path.dirname(moddedFile)));

      if (root && !packageRoots[root]) {
        try {
          const packageName = JSON.parse(fs.readFileSync(path.join(root, 'package.json')).toString()).name;
          packageRoots[root] = packageName;
        } catch (e) {
          // Ignore JSON errors
        }
      }
    });
  }

  if (findLernaConfig(cwd)) {
    const packagePatterns = getPackagePatterns(cwd);

    return Object.keys(packageRoots)
      .filter(pkgPath => {
        for (let pattern of packagePatterns) {
          const relativePath = path.relative(cwd || process.cwd(), pkgPath);

          if (minimatch(relativePath, pattern)) {
            return true;
          }
        }

        return false;
      })
      .map(pkgPath => {
        return packageRoots[pkgPath];
      });
  } else {
    return Object.values(packageRoots);
  }
}

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
      const change = {
        ...changes[pkgName],
        scope: pkgName,
        author: getUserEmail(cwd),
        sha1: getCurrentHash(cwd)
      };

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
