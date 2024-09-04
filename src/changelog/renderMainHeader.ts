import { PackageChangelog } from '../types/ChangeLog';

export async function renderMainHeader(newVersionChangelog: PackageChangelog) {
  return `# Change Log - ${newVersionChangelog.name}`;
}
