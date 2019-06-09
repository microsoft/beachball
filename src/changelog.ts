import { getPackageChanges, readChangeFiles } from './changefile';

interface ChangelogEntry {
  comment: string;
  email: string;
  commit: string;
}

interface PackageChangelog {
  name: string;
  date: string;
  changes: {
    patch?: ChangelogEntry[];
    minor?: ChangelogEntry[];
    major?: ChangelogEntry[];
    none?: ChangelogEntry[];
  };
}

export function getPackageChangelogs(cwd?: string) {
  const changeTypeWeights = {
    major: 3,
    minor: 2,
    patch: 1,
    none: 0
  };
  const changes = readChangeFiles(cwd);
  const changelogs: { [pkgName: string]: PackageChangelog } = {};
  changes.forEach(change => {
    const { packageName } = change;

    changelogs[packageName] = changelogs[packageName] || {
      name: packageName,
      date: new Date().toISOString()
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

export function writeChangelog(cwd?: string) {
  // {[pkg]: changeinfo}

  const changelogs = getPackageChangelogs(cwd);
  Object.keys(changelogs).forEach(pkg => {});
}
