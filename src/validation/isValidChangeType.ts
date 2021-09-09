import { SortedChangeTypes } from '../changefile/getPackageChangeTypes';
import { ChangeType } from '../types/ChangeInfo';

export function isValidChangeType(changeType: string, disallowedChangeTypes?: ChangeType[] | null) {
  return SortedChangeTypes.includes(changeType as any) && !disallowedChangeTypes?.includes(changeType as any);
}
