export interface ChangeInfo {
  type: 'patch' | 'minor' | 'major' | 'none';
  comment: string;
  packageName: string;
  email: string;
  commit: string;
  date: Date;
}
