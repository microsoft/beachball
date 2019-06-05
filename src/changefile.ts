import prompts from 'prompts';
import { getRecentCommitMessages, getUserEmail, getChanges } from './git';
import fs from 'fs';
import path from 'path';
import { getChangePath, findPackageRoot } from './paths';
import { findLernaConfig, getPackagePatterns } from './monorepo';
import minimatch from 'minimatch';

export async function promptForChange(cwd?: string) {
  const changedPackages = getChangedPackages(cwd);
  const recentMessages = getRecentCommitMessages(cwd) || [];
  const packageChangeInfo: any = {};

  return await changedPackages.reduce(async (currentPromise, pkg) => {
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
  }, Promise.resolve<any>(null));
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

export function writeChangeFile(changePromptResponse: ReturnType<typeof promptForChange>, cwd?: string) {
  const changePath = getChangePath(cwd)!;
  const changeFile = path.join(changePath, 'change.json');

  const change = {
    ...changePromptResponse,
    scopes: getChangedPackages(),
    author: getUserEmail()
  };

  fs.writeFileSync(changeFile, JSON.stringify(change, null, 2));
}
