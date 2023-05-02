import stream from 'stream';
import stripAnsi from 'strip-ansi';

/**
 * prompts uses a different set of figures on Windows terminals vs. other platforms for compatibility.
 * For snapshots, replace the non-Windows figures with Windows versions. (Doing a find/replace on the
 * "pretty" non-Windows figures is less likely to accidentally replace sequences that might appear
 * in standard text.)
 * https://github.com/terkelg/prompts/blob/master/lib/util/figures.js
 */
const promptsFigures: [RegExp, string][] = [
  [/◉/g, '(*)'],
  [/◯/g, '( )'],
  [/✔/g, '√'],
  [/✖/g, '×'],
  [/…/g, '...'],
  [/›/g, '»'],
  [/❯/g, '>'],
];

/**
 * Mock stdout stream which keeps a record of the chunks written to it (transforming them in an
 * appropriate way for snapshots) but doesn't actually output anything.
 */
export class MockStdout extends stream.Writable {
  private chunks: string[] = [];
  private ignoreChunks: RegExp[];
  private replace: [RegExp, string][];

  constructor(options: { ignoreChunks?: RegExp[]; replace?: [RegExp, string][] | 'prompts' } = {}) {
    super();
    this.ignoreChunks = options.ignoreChunks || [];
    this.replace = options.replace === 'prompts' ? promptsFigures : options.replace || [];
  }

  /** Gets non-empty output chunks that have been written to the stream, joined with newlines */
  getOutput() {
    return this.chunks.join('\n');
  }

  /** Gets the last non-empty output chunk written to the stream */
  lastOutput() {
    return this.chunks.slice(-1)[0];
  }

  /** Clears the record of output to the stream */
  clearOutput() {
    this.chunks = [];
  }

  _write(chunk: any, encoding: string, callback: (error?: Error | null) => void) {
    // Trim each line so that if it's used in a snapshot, there won't be trailing whitespace issues
    let text = stripAnsi(chunk.toString())
      .split('\n')
      .map(line => line.trimEnd())
      .join('\n')
      .trim();

    for (const [from, to] of this.replace) {
      text = text.replace(from, to);
    }

    // Ignore blank lines, or lines containing sequences requested to be ignored
    if (text && !this.ignoreChunks.some(r => r.test(text))) {
      this.chunks.push(text);
    }
    callback();
  }
}
