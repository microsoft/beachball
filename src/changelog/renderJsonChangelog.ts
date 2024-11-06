import { PackageChangelog, ChangelogJson } from '../types/ChangeLog';

export function renderJsonChangelog(params: {
  changelog: PackageChangelog;
  previousChangelog: ChangelogJson | undefined;
  maxVersions: number | undefined;
}): ChangelogJson {
  const { changelog, previousChangelog, maxVersions } = params;
  const { name, date, ...rest } = changelog;

  let previousEntries = previousChangelog?.entries || [];
  if (maxVersions) {
    previousEntries = previousEntries.slice(0, maxVersions - 1);
  }

  return {
    name,
    entries: [
      {
        date: changelog.date.toUTCString(),
        ...rest,
      },
      ...previousEntries,
    ],
  };
}
