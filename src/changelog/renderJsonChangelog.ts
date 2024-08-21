import { PackageChangelog, ChangelogJson } from '../types/ChangeLog';

export function renderJsonChangelog(
  changelog: PackageChangelog,
  previousChangelog: ChangelogJson | undefined
): ChangelogJson {
  const { name, date, ...rest } = changelog;
  return {
    name,
    entries: [
      {
        date: changelog.date.toUTCString(),
        ...rest,
      },
      ...(previousChangelog?.entries || []),
    ],
  };
}
