import { describe, it, expect } from '@jest/globals';
import { bulletedList } from '../../logging/bulletedList';

describe('bulletedList', () => {
  it('bullets a flat array', () => {
    expect(bulletedList(['Item 1', 'Item 2', 'Item 3'])).toMatchInlineSnapshot(`
      "  • Item 1
        • Item 2
        • Item 3"
    `);
  });

  it('indents multi-line bullet points', () => {
    expect(bulletedList(['Item 1', 'Item 2\nStack:\n  something', 'Item 3'])).toMatchInlineSnapshot(`
      "  • Item 1
        • Item 2
          Stack:
            something
        • Item 3"
    `);
  });

  it('indents as requested', () => {
    expect(bulletedList(['Item 1', 'Item 2', 'Item 3'], 2)).toMatchInlineSnapshot(`
      "    ▪ Item 1
          ▪ Item 2
          ▪ Item 3"
    `);
  });

  it('handles one level of nesting', () => {
    expect(bulletedList(['Item 1', 'Item 2', ['Nested 1']])).toMatchInlineSnapshot(`
      "  • Item 1
        • Item 2
          ▪ Nested 1"
    `);
  });

  it('handles nested arrays', () => {
    expect(
      bulletedList([
        'Item 1',
        'Item 2',
        [
          'Nested Item 1',
          ['Extra nested 1\nanother line', 'Extra nested 2', ['More nesting', ['Even more', ['Ran out of bullets']]]],
          'Nested Item 2',
        ],

        'Item 3',
      ])
    ).toMatchInlineSnapshot(`
      "  • Item 1
        • Item 2
          ▪ Nested Item 1
            ◦ Extra nested 1
              another line
            ◦ Extra nested 2
              ▫ More nesting
                - Even more
                  • Ran out of bullets
          ▪ Nested Item 2
        • Item 3"
    `);
  });

  it('throws if level is less than 1', () => {
    expect(() => bulletedList(['hello'], 0)).toThrow('Level must be 1 or greater');
    expect(() => bulletedList(['hello'], -1)).toThrow('Level must be 1 or greater');
  });
});
