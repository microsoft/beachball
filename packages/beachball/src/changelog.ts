import { readChangeFiles, unlinkChangeFiles } from './changefile';
import { PackageInfo } from './bump';
import path from 'path';
import fs from 'fs';

interface ChangelogEntry {
  comment: string;
  email: string;
  author?: string;
  commit: string;
}

interface PackageChangelog {
  name: string;
  date: Date;
  version: string;
  changes: {
    patch?: ChangelogEntry[];
    minor?: ChangelogEntry[];
    major?: ChangelogEntry[];
    none?: ChangelogEntry[];
  };
}

interface ChangelogJsonEntry {
  date: string,
  version: string,
  changes: {
    patch?: ChangelogEntry[];
    minor?: ChangelogEntry[];
    major?: ChangelogEntry[];
    none?: ChangelogEntry[];
  }
}

interface ChangelogJson {
  name: string;
  entries: ChangelogJsonEntry[];
}

export function getPackageChangelogs(packageInfos: { [pkg: string]: PackageInfo }, cwd: string) {
  const changes = readChangeFiles(cwd);
  const changelogs: { [pkgName: string]: PackageChangelog } = {};
  changes.forEach(change => {
    const { packageName } = change;

    changelogs[packageName] = changelogs[packageName] || {
      name: packageName,
      version: packageInfos[packageName].version,
      date: new Date()
    };

    changelogs[packageName].changes = changelogs[packageName].changes || {};
    changelogs[packageName].changes[change.type] = changelogs[packageName].changes[change.type] || [];
    changelogs[packageName].changes[change.type]!.push({
      comment: change.comment,
      email: change.email,
      commit: change.commit
    });
  });

  return changelogs;
}

export function writeChangelog(packageInfos: { [pkg: string]: PackageInfo }, cwd: string) {
  const changelogs = getPackageChangelogs(packageInfos, cwd);

  Object.keys(changelogs).forEach(pkg => {
    const packagePath = path.dirname(packageInfos[pkg].packageJsonPath);

    const changelogFile = path.join(packagePath, 'CHANGELOG.md');
    const previousContent = fs.existsSync(changelogFile) ? fs.readFileSync(changelogFile).toString() : '';
    const nextContent = renderChangelog(previousContent, changelogs[pkg]);
    fs.writeFileSync(changelogFile, nextContent);

    try {
      const changelogJsonFile = path.join(packagePath, 'CHANGELOG.json');
      const previousJson = fs.existsSync(changelogJsonFile) ? JSON.parse(fs.readFileSync(changelogJsonFile).toString()) : {};
      const nextJson = renderJsonChangelog(previousJson, changelogs[pkg]);
      fs.writeFileSync(changelogJsonFile, JSON.stringify(nextJson, null, 2));
    } catch (e) {
      console.warn("The CHANGELOG.json file is invalid, skipping writing to it")
    }
  });

  unlinkChangeFiles(cwd);
}

function renderJsonChangelog(previous: ChangelogJson, changelog: PackageChangelog) {
  console.log('previous\n', previous.entries);

  const result: ChangelogJson = {
    name: changelog.name,
    entries: [...previous.entries] || []
  };

  const newEntry: ChangelogJsonEntry = {
    date: changelog.date.toUTCString(),
    version: changelog.version,
    changes: changelog.changes
  }

  result.entries.unshift(newEntry);

  return result;
}

function renderChangelog(previous: string, changelog: PackageChangelog) {
  return (
    `# Changelog - ${changelog.name}\n\n` +
    `This log was last generated on ${changelog.date.toUTCString()} and should not be manually modified.\n` +
    renderPackageChangelog(changelog) +
    (previous
      ? previous
        .split(/\n/g)
        .slice(3)
        .join('\n')
      : '')
  );
}

function renderPackageChangelog(changelog: PackageChangelog) {
  return (
    `\n## ${changelog.version}\n` +
    `${changelog.date.toUTCString()}\n` +
    (changelog.changes.major ? '\n### Major\n\n' + changelog.changes.major.map(change => `- ${change.comment} (${change.email})\n`) : '') +
    (changelog.changes.minor ? '\n### Minor\n\n' + changelog.changes.minor.map(change => `- ${change.comment} (${change.email})\n`) : '') +
    (changelog.changes.patch ? '\n### Patches\n\n' + changelog.changes.patch.map(change => `- ${change.comment} (${change.email})\n`) : '')
  );
}
