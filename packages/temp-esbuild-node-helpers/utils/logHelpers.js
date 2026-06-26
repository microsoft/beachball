import { environmentInfo } from '@ms-cloudpack/environment';
import defaultColors, { createColors } from 'picocolors';
// This package uses some custom helpers instead of task-reporter since it may be used elsewhere
/** picocolors instance that's disabled in jest */
export const colors = environmentInfo.isJest ? createColors(false) : defaultColors;
const errorPrefix = environmentInfo.ado ? '##vso[task.logissue type=error]' : environmentInfo.isCI ? '::error::' : '';
/**
 * Log an error, with a special error prefix if running in github or ADO.
 *
 * If `message` is an Error object, it will log the stack.
 */
export function logError(message) {
  console.error(`${errorPrefix}${String((message instanceof Error && message.stack) || message)}`);
}
export function bulletedList(lines, indent = 1) {
  const indentString = ' '.repeat(indent * 2);
  return lines
    .reduce((result, curr) => {
      if (curr) {
        result.push(Array.isArray(curr) ? bulletedList(curr, indent + 1) : `${indentString}- ${curr}`);
      }
      return result;
    }, [])
    .join('\n');
}
//# sourceMappingURL=logHelpers.js.map
