import type { BeachballOptions } from '../types/BeachballOptions';
import { validateWithBump } from '../validation/validate';

export function check(options: BeachballOptions): void {
  // 'check' should include validation of dependencies, which requires the in-memory bump step
  validateWithBump(options, { checkChangeNeeded: true });
  console.log('No change files are needed');
}
