import { SortedChangeTypes } from '../changefile/changeTypes';
import type { ChangeType } from '../types/ChangeInfo';

export function isValidChangeType(changeType: string): boolean {
  return SortedChangeTypes.includes(changeType as ChangeType);
}
