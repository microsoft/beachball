import { PackageInfo } from './bump';
import path from 'path';
import fs from 'fs';
import { generateTag } from './tag';
import { ChangeInfo, ChangeSet } from './ChangeInfo';

interface ChangelogEntry {
  comment: string;
  author: string;
  commit: string;
}

interface PackageChangelog {
  name: string;
  date: Date;
  version: string;
  comments: {
    prerelease?: ChangelogEntry[];
    patch?: ChangelogEntry[];
    minor?: ChangelogEntry[];
    major?: ChangelogEntry[];
    none?: ChangelogEntry[];
  };
}

interface ChangelogJsonEntry {
  date: string;
  version: string;
  tag: string;
  comments: {
    prerelease?: ChangelogEntry[];
    patch?: ChangelogEntry[];
    minor?: ChangelogEntry[];
    major?: ChangelogEntry[];
    none?: ChangelogEntry[];
  };
}

interface ChangelogJson {
  name: string;
  entries: ChangelogJsonEntry[];
}

export function getPackageChangelogs(changeSet: ChangeSet, packageInfos: { [pkg: string]: PackageInfo }) {
  const changelogs: { [pkgName: string]: PackageChangelog } = {};

  for (let [_, change] of changeSet) {
    const { packageName } = change;

    changelogs[packageName] = changelogs[packageName] || {
      name: packageName,
      version: packageInfos[packageName].version,
      date: new Date(),
    };

    changelogs[packageName].comments = changelogs[packageName].comments || {};
    changelogs[packageName].comments[change.type] = changelogs[packageName].comments[change.type] || [];
    changelogs[packageName].comments[change.type]!.push({
      comment: change.comment,
      author: change.email,
      commit: change.commit,
    });
  }

  return changelogs;
}

export function writeChangelog(changeSet: ChangeSet, packageInfos: { [pkg: string]: PackageInfo }) {
  const changelogs = getPackageChangelogs(changeSet, packageInfos);

  Object.keys(changelogs).forEach(pkg => {
    const packagePath = path.dirname(packageInfos[pkg].packageJsonPath);

    if (
      changelogs[pkg].comments.major ||
      changelogs[pkg].comments.minor ||
      changelogs[pkg].comments.patch ||
      changelogs[pkg].comments.prerelease
    ) {
      const changelogFile = path.join(packagePath, 'CHANGELOG.md');
      const previousContent = fs.existsSync(changelogFile) ? fs.readFileSync(changelogFile).toString() : '';
      const nextContent = renderChangelog(previousContent, changelogs[pkg]);
      fs.writeFileSync(changelogFile, nextContent);
    }

    try {
      const changelogJsonFile = path.join(packagePath, 'CHANGELOG.json');
      const previousJson = fs.existsSync(changelogJsonFile)
        ? JSON.parse(fs.readFileSync(changelogJsonFile).toString())
        : { entries: [] };
      const nextJson = renderJsonChangelog(previousJson, changelogs[pkg]);
      fs.writeFileSync(changelogJsonFile, JSON.stringify(nextJson, null, 2));
    } catch (e) {
      console.warn('The CHANGELOG.json file is invalid, skipping writing to it', e);
    }
  });
}

function renderJsonChangelog(previous: ChangelogJson, changelog: PackageChangelog) {
  const result: ChangelogJson = {
    name: changelog.name,
    entries: [...previous.entries] || [],
  };

  const newEntry: ChangelogJsonEntry = {
    date: changelog.date.toUTCString(),
    tag: generateTag(changelog.name, changelog.version),
    version: changelog.version,
    comments: changelog.comments,
  };

  result.entries.unshift(newEntry);

  return result;
}

function renderChangelog(previous: string, changelog: PackageChangelog) {
  const previousLogEntries = previous ? '\n' + previous.substring(previous.indexOf('##')) : '';

  return (
    `# Change Log - ${changelog.name}\n\n` +
    `This log was last generated on ${changelog.date.toUTCString()} and should not be manually modified.\n` +
    renderPackageChangelog(changelog) +
    previousLogEntries
  );
}

function renderPackageChangelog(changelog: PackageChangelog) {
  return (
    `\n## ${changelog.version}\n` +
    `${changelog.date.toUTCString()}\n` +
    (changelog.comments.major
      ? '\n### Major\n\n' + changelog.comments.major.map(change => `- ${change.comment} (${change.author})`).join('\n')
      : '') +
    (changelog.comments.minor
      ? '\n### Minor changes\n\n' +
        changelog.comments.minor.map(change => `- ${change.comment} (${change.author})`).join('\n')
      : '') +
    (changelog.comments.patch
      ? '\n### Patches\n\n' +
        changelog.comments.patch.map(change => `- ${change.comment} (${change.author})`).join('\n')
      : '') +
    (changelog.comments.prerelease
      ? '\n### Changes\n\n' +
        changelog.comments.prerelease.map(change => `- ${change.comment} (${change.author})`).join('\n')
      : '')
  );
}
