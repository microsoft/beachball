import { SortedChangeTypes } from '../changefile/changeTypes';

export function isValidChangeType(changeType: string) {
  return SortedChangeTypes.includes(changeType as any);
}
