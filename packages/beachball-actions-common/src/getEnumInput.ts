import * as core from '@actions/core';

/**
 * Gets the value of an action input and validates that it's one of a list of allowed values
 * (or if not, sets the action as failed and exits the program).
 * @param inputName Name of the action input
 * @param allowedValues List of possible values
 * @param defaultValue Default value (if not provided, input is assumed to be required)
 * @returns The actual (or default) value
 */
export function getEnumInput<TValue extends string>(
  inputName: string,
  allowedValues: ReadonlyArray<TValue>,
  defaultValue?: TValue,
): TValue {
  const required = typeof defaultValue !== 'string';
  const value = core.getInput(inputName, { required }) || defaultValue || '';
  if (!allowedValues.includes(value as TValue)) {
    const allowedValuesStr = allowedValues.map((v) => `"${v}"`).join(' or ');
    core.setFailed(
      `Valid options for "${inputName}" are ${allowedValuesStr} (received "${value}")`,
    );
    process.exit(1);
  }
  return value as TValue;
}
