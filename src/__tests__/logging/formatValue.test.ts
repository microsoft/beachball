import { describe, expect, it } from '@jest/globals';
import { formatValue } from '../../logging/formatValue';
import { BeachballError } from '../../types/BeachballError';

describe('formatValue', () => {
  describe('basic values', () => {
    it.each<[unknown, string]>([
      [undefined, 'undefined'],
      [null, 'null'],
      ['string', '"string"'],
      ['string spaces', '"string spaces"'],
      ['', '""'],
      [42, '42'],
      [true, 'true'],
      [false, 'false'],
    ])('formats primitive %p', (input, expected) => {
      expect(formatValue(input)).toBe(expected);
    });

    it('generically formats function', () => {
      expect(formatValue(() => {})).toBe('(Function)');
    });

    it('generically formats class instances', () => {
      expect(formatValue(new Date())).toBe('(Date)');
      expect(formatValue(/regex/)).toBe('(RegExp)');
      expect(formatValue(new BeachballError('hi'))).toBe('(BeachballError)');
    });
  });

  describe('arrays', () => {
    it('formats empty array', () => {
      expect(formatValue([])).toBe('[]');
    });

    it('formats short array on single line', () => {
      expect(formatValue(['a', 'b', undefined, 1, 2])).toBe('["a", "b", undefined, 1, 2]');
    });

    it('formats long array with YAML-like list syntax', () => {
      const formatted = formatValue(['a-long-value', 'another-long-value', 'yet-another'], { maxWidth: 40 });
      // No leading whitespace or newline at level 0 (previous bug)
      expect(formatted).not.toMatch(/^\s/);
      expect(formatted).toMatchInlineSnapshot(`
        "- "a-long-value"
        - "another-long-value"
        - "yet-another""
      `);
    });

    it('formats array of objects', () => {
      const groups = [
        { name: 'group-a', someArray: ['major'] },
        { name: 'group-b', someArray: ['major', 'minor'] },
      ];
      const formatted = formatValue(groups);
      const lines = formatted.split('\n');
      // Explicitly check indentation (previous bug)
      expect(lines[0]).toMatch(/^- name:/);
      expect(lines[1]).toMatch(/^  someArray:/);
      expect(formatValue(groups)).toMatchInlineSnapshot(`
        "- name: "group-a"
          someArray: ["major"]
        - name: "group-b"
          someArray: ["major", "minor"]"
      `);
    });
  });

  describe('objects', () => {
    it('formats empty object', () => {
      expect(formatValue({})).toBe('{}');
    });

    it('formats object with YAML-like key: value lines', () => {
      const formatted = formatValue({ a: 1, b: 'two' });
      const lines = formatted.split('\n');
      // No leading whitespace (previous bug)
      expect(lines[0]).toMatch(/^a:/);
      expect(lines[1]).toMatch(/^b:/);
      expect(formatted).toMatchInlineSnapshot(`
        "a: 1
        b: "two""
      `);
    });

    it('formats nested objects', () => {
      // Separate lines with indentation for nested objects (previous bug)
      expect(formatValue({ outer: { inner: true } })).toEqual('outer:\n  inner: true');
    });

    it('formats object with mixed value types', () => {
      expect(formatValue({ name: 'test', count: 3, func: () => {}, enabled: true, data: null })).toMatchInlineSnapshot(`
        "name: "test"
        count: 3
        func: (Function)
        enabled: true
        data: null"
      `);
    });

    it('formats deeply nested mixed types', () => {
      const config = {
        name: 'my-repo',
        someBool: true,
        arrayOfObjects: [
          {
            name: 'core',
            include: ['packages/core/very-long-path-extra-long/*'],
            someArray: ['major'],
          },
          {
            name: 'utils',
            include: ['packages/utils/*'],
            someArray: null,
          },
        ],
        customStuff: {
          extra: {
            renderFoo: () => '',
            renderBar: () => '',
          },
          groups: [{ someValue: 'core', otherValue: 'changelog' }],
        },
        stringArray: ['packages/*', '!packages/internal/*'],
      };

      // Review snapshot changes carefully!
      // Silly things can happen with indentation and whitespace!
      expect(formatValue(config, { maxWidth: 40 })).toMatchInlineSnapshot(`
        "name: "my-repo"
        someBool: true
        arrayOfObjects:
          - name: "core"
            include:
              - "packages/core/very-long-path-extra-long/*"
            someArray: ["major"]
          - name: "utils"
            include: ["packages/utils/*"]
            someArray: null
        customStuff:
          extra:
            renderFoo: (Function)
            renderBar: (Function)
          groups:
            - someValue: "core"
              otherValue: "changelog"
        stringArray: ["packages/*", "!packages/internal/*"]"
      `);
    });

    it('does not quote keys, even if invalid identifiers', () => {
      expect(formatValue({ '/path/to/key': 1, 'key-with-hyphens': 2, normalKey: 3 })).toMatchInlineSnapshot(`
        "/path/to/key: 1
        key-with-hyphens: 2
        normalKey: 3"
      `);
    });
  });

  describe('level', () => {
    it('respects initial level for objects', () => {
      expect(formatValue({ a: 1 }, { level: 4 })).toMatchInlineSnapshot(`"        a: 1"`);
    });

    it('respects initial level for arrays exceeding width', () => {
      expect(formatValue([1, 2], { level: 4, maxWidth: 6 })).toMatchInlineSnapshot(`
        "        - 1
                - 2"
      `);
    });

    it('respects level for array with single long value', () => {
      const formatted = formatValue(['a-long-value'], { maxWidth: 10, level: 2 });
      // Previous bug: the space would get trimmed since there's no newline in the array
      expect(formatted).toEqual(`    - "a-long-value"`);
    });

    it('respects level for single-value array key of object', () => {
      const formatted = formatValue({ key: ['a-long-value'] }, { maxWidth: 10, level: 2 });
      // Previous bug: the space would get trimmed since there's no newline in the array
      expect(formatted).toEqual(`    key:\n      - "a-long-value"`);
    });

    it('keeps short array on single line when it fits even with level', () => {
      // Level 4 = 8 spaces indent. [1, 2] is 6 chars. 8 + 6 = 14, fits in maxWidth 14
      expect(formatValue([1, 2], { level: 4, maxWidth: 14 })).toBe('        [1, 2]');
    });

    it('accounts for level when checking width limit', () => {
      // Level 5 = 10 spaces indent. ["a"] is 5 chars. 10 + 5 = 15, fits in maxWidth 15
      expect(formatValue(['a'], { level: 5, maxWidth: 15 })).toBe('          ["a"]');
      // 10 + 5 = 15 > 14, goes to list format
      expect(formatValue(['a'], { level: 5, maxWidth: 14 })).toBe('          - "a"');
    });
  });
});
