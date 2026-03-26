import { describe, expect, it } from '@jest/globals';
import { formatValue } from '../../logging/formatValue';

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

    it('formats function', () => {
      expect(formatValue(() => {})).toBe('[Function]');
    });
  });

  describe('arrays', () => {
    it('formats empty array', () => {
      expect(formatValue([])).toBe('[]');
    });

    it('formats short array on single line', () => {
      expect(formatValue(['a', 'b'])).toBe('["a", "b"]');
    });

    it('formats long array on multiple lines', () => {
      expect(formatValue(['a-long-value', 'another-long-value', 'yet-another'], { widthLimit: 40 }))
        .toMatchInlineSnapshot(`
        "[
          "a-long-value",
          "another-long-value",
          "yet-another"
        ]"
      `);
    });

    it('formats array of numbers on single line', () => {
      expect(formatValue([1, 2, 3])).toBe('[1, 2, 3]');
    });
  });

  describe('objects', () => {
    it('formats empty object', () => {
      expect(formatValue({})).toBe('{}');
    });

    it('formats short object on single line', () => {
      expect(formatValue({ a: 1, b: 'two' })).toBe('{ a: 1, b: "two" }');
    });

    it('formats long object on multiple lines', () => {
      expect(formatValue({ longKeyName: 'long-value', anotherKey: 'another-value' }, { widthLimit: 40 }))
        .toMatchInlineSnapshot(`
        "{
          longKeyName: "long-value",
          anotherKey: "another-value"
        }"
      `);
    });

    it('formats nested objects on single line when short', () => {
      expect(formatValue({ outer: { inner: true } })).toBe('{ outer: { inner: true } }');
    });

    it('formats deeply nested objects on multiple lines when exceeding width', () => {
      expect(formatValue({ outer: { inner: { deep: 'value' } } }, { widthLimit: 30 })).toMatchInlineSnapshot(`
        "{
          outer: { inner: { deep: "value" } }
        }"
      `);
    });

    it('formats object with function values on single line', () => {
      expect(formatValue({ prepublish: () => {}, postpublish: () => {} })).toBe(
        '{ prepublish: [Function], postpublish: [Function] }'
      );
    });

    it('formats object with mixed value types on single line', () => {
      expect(formatValue({ name: 'test', count: 3, enabled: true, data: null })).toBe(
        '{ name: "test", count: 3, enabled: true, data: null }'
      );
    });

    it('quotes keys that are not valid identifiers', () => {
      expect(formatValue({ '/path/to/key': 1, 'key-with-hyphens': 2, normalKey: 3 })).toBe(
        '{ "/path/to/key": 1, "key-with-hyphens": 2, normalKey: 3 }'
      );
    });
  });

  describe('width limit', () => {
    it('uses single line when within default width limit', () => {
      expect(formatValue(['major', 'minor'])).toBe('["major", "minor"]');
    });

    it('uses multi-line when exceeding width limit', () => {
      expect(formatValue(['major', 'minor'], { widthLimit: 10 })).toMatchInlineSnapshot(`
        "[
          "major",
          "minor"
        ]"
      `);
    });

    it('accounts for indent when checking width limit', () => {
      // At indent 70 with widthLimit=75, ["a"] (5 chars) + 70 = 75, fits on single line
      expect(formatValue(['a'], { indent: 70, widthLimit: 75 })).toBe('["a"]');
      // At indent 70 with widthLimit=74, ["a"] (5 chars) + 70 = 75 > 74, goes multi-line
      expect(formatValue(['a'], { indent: 70, widthLimit: 74 })).toContain('\n');
    });

    it('goes multi-line when a child value is multi-line', () => {
      expect(formatValue([{ longKey: 'longValue', anotherKey: 'anotherValue' }], { widthLimit: 30 }))
        .toMatchInlineSnapshot(`
        "[
          {
            longKey: "longValue",
            anotherKey: "anotherValue"
          }
        ]"
      `);
    });

    it('formats nested array inside object on single line when short', () => {
      const group = { name: 'my-group', disallowedChangeTypes: ['major'] };
      expect(formatValue(group)).toBe('{ name: "my-group", disallowedChangeTypes: ["major"] }');
    });

    it('breaks object to multi-line while keeping short nested array inline', () => {
      const group = { name: 'my-group', disallowedChangeTypes: ['major', 'minor', 'patch'] };
      expect(formatValue(group, { widthLimit: 50 })).toMatchInlineSnapshot(`
        "{
          name: "my-group",
          disallowedChangeTypes: ["major", "minor", "patch"]
        }"
      `);
    });
  });

  describe('indentation', () => {
    it('respects initial indent for objects', () => {
      expect(formatValue({ a: 1 }, { indent: 4, widthLimit: 10 })).toBe('{\n      a: 1\n    }');
    });

    it('respects initial indent for arrays', () => {
      // [1] is 3 chars + indent 4 = 7, fits in widthLimit 10
      expect(formatValue([1], { indent: 4, widthLimit: 10 })).toBe('[1]');
      // [1] is 3 chars + indent 4 = 7 > widthLimit 6, goes multi-line
      expect(formatValue([1], { indent: 4, widthLimit: 6 })).toBe('[\n      1\n    ]');
    });
  });
});
