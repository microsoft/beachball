/**
 * Recursively freeze an object to verify it's not modified.
 */
export function deepFreeze<T>(obj: T): Readonly<T> {
  Object.freeze(obj);
  deepFreezeProperties(obj);
  return obj;
}

export function deepFreezeProperties<T>(obj: T): T {
  if (!obj || typeof obj !== 'object') return obj;

  Object.getOwnPropertyNames(obj).forEach(prop => {
    // eslint-disable-next-line
    const value = (obj as any)[prop];
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  });
  return obj;
}
