import { SortedChangeTypes } from '../changefile/changeTypes';

export function isValidChangeType(changeType: string): boolean {
  return SortedChangeTypes.includes(changeType as any);
}
