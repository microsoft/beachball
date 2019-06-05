export interface ChangeInfo {
  type: 'patch' | 'minor' | 'major' | 'none';
  description: string;
  packageName: string;
  email: string;
  hash: string;
}
