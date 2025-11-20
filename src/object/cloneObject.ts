/**
 * Clone an object, fast.
 * Currently only handles data types expected in `BumpInfo` but could be expanded if needed.
 *
 * This is decently faster than `structuredClone` or `JSON.parse(JSON.stringify())` on a
 * very large object (bump info can be huge in certain repos). https://jsperf.app/rugosa/5
 *
 * @internal Exported for testing (and usage in tests)
 */
export function cloneObject<T extends unknown[]>(obj: T): T;
export function cloneObject<T extends object>(obj: T): T;
export function cloneObject<T extends object>(obj: T): T {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    const clone = [] as typeof obj;
    for (let i = 0; i < obj.length; i++) {
      const val = obj[i];
      // Skip the recursive call if not an object.
      // This check is repeatedly done inline on sub-properties for performance.
      clone[i] = val && typeof val === 'object' ? cloneObject(val) : val;
    }
    return clone;
  }

  if (obj instanceof Set) {
    return new Set(Array.from(obj).map(item => (item && typeof item === 'object' ? cloneObject(item) : item))) as T;
  }

  if (obj.constructor?.name && obj.constructor.name !== 'Object') {
    throw new Error(`Unsupported object type found while cloning bump info: ${obj.constructor.name}`);
  }

  const clone = {} as typeof obj;
  for (const [key, val] of Object.entries(obj)) {
    (clone as any)[key] = val && typeof val === 'object' ? cloneObject(val) : val;
  }
  return clone;
}
