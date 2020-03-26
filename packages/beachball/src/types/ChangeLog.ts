/**
 * !!!! IMPORTANT !!!!
 * Change made on interfaces here can effect custom changelog rendering done by end-user.
 */

export interface ChangelogEntry {
  comment: string;
  author: string;
  commit: string;
  package: string;
}

export interface PackageChangelog {
  name: string;
  date: Date;
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

export interface ChangelogJsonEntry {
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

export interface ChangelogJson {
  name: string;
  entries: ChangelogJsonEntry[];
}
