import { describe, it, expect } from '@jest/globals';
import { indent } from '../../logging/indent';

describe('indent', () => {
  it('indents by specified level', () => {
    expect(indent('hello', 0)).toBe('hello');
    expect(indent('hello', 1)).toBe('  hello');
    expect(indent('hello', 2)).toBe('    hello');
  });

  it('indents multi-line text', () => {
    expect(indent('hello\nworld', 1)).toBe('  hello\n  world');
    // preserves existing indentation
    expect(indent('hello\n  world', 1)).toBe('  hello\n    world');
  });

  it('indents multi-line text with first-line offset', () => {
    expect(indent('hello\nworld', 1, -1)).toBe('hello\n  world');
    expect(indent('hello\nworld', 2, -1)).toBe('  hello\n    world');
    expect(indent('hello\nworld', 1, 1)).toBe('    hello\n  world');
    expect(indent('hello\nworld', 2, -2)).toBe('hello\n    world');
    expect(indent('hello\n  world', 1, -1)).toBe('hello\n    world');
  });

  it('throws if level is less than 0', () => {
    expect(() => indent('hello', -1)).toThrow('Level must be 0 or greater');
  });

  it('throws if firstLineOffset would result in negative indent', () => {
    expect(() => indent('hello', 1, -2)).toThrow('First line cannot have negative indent');
  });
});
