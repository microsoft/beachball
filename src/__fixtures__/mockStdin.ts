import stream from 'stream';
import readline from 'readline';

/**
 * Mock stdin stream. This is a modernized version of https://www.npmjs.com/package/mock-stdin
 * with a couple additional methods.
 */
export class MockStdin extends stream.Readable {
  readonly isMock = true;
  private readonly _mockData: MockData[] = [];
  private readonly _flags: {
    emittedData: boolean;
    lastOutput: string | Buffer | null;
  } = {
    emittedData: false,
    lastOutput: null,
  };
  // @ts-expect-error private property of parent class
  private _readableState: { length: number; ended: boolean; endEmitted: boolean; buffer: any[] };

  constructor(private restoreTarget?: stream.Stream) {
    super({ highWaterMark: 0 });
  }

  emit(event: string, ...args: any[]): boolean {
    if (event === 'data') {
      this._flags.emittedData = true;
      this._flags.lastOutput = null;
    }
    return super.emit(event, ...args);
  }

  /**
   * Emit a keypress event as defined by `readline`
   * https://nodejs.org/api/readline.html#rlwritedata-key
   */
  emitKey(key: readline.Key) {
    return this.emit('keypress', null, key);
  }

  /**
   * Send text in a way that's presumably intended to simulate real `process.stdin` input
   * (this approach is copied from `mock-stdin`).
   */
  send(text: string[] | Buffer | string | null, encoding?: string) {
    if (Array.isArray(text)) {
      if (encoding) {
        throw new TypeError('Cannot invoke MockStdin#send(): `encoding` specified while text specified as an array.');
      }
      text = text.join('\n');
    }
    if (Buffer.isBuffer(text) || typeof text === 'string' || text === null) {
      this._mockData.push(new MockData(text, encoding));
      this._read();
      if (!this._flags.emittedData && this._readableState.length) {
        this.drainData();
      }
      if (text === null) {
        // Trigger an end event synchronously...
        this.endReadable();
      }
    }
    return this;
  }

  /**
   * Send `text` character by character (with `process.nextTick` in between) to simulate typing.
   */
  async sendByChar(text: string) {
    await new Promise(resolve => process.nextTick(resolve));
    for (const char of text) {
      this.send(char);
      await new Promise(resolve => process.nextTick(resolve));
    }
    return this;
  }

  end() {
    this.send(null);
    return this;
  }

  restore() {
    if (this.restoreTarget) {
      Object.defineProperty(process, 'stdin', {
        value: this.restoreTarget,
        configurable: true,
        writable: false,
      });
    }
    return this;
  }

  reset(removeListeners: boolean) {
    this._readableState.ended = false;
    this._readableState.endEmitted = false;
    if (removeListeners) {
      this.removeAllListeners();
    }
    return this;
  }

  _read(size: number = Infinity) {
    let count = 0;
    let read = true;
    while (read && this._mockData.length && count < size) {
      const item = this._mockData[0];
      const leftInChunk = item.length - item.pos;
      const remaining = size === Infinity ? leftInChunk : size - count;
      const toProcess = Math.min(leftInChunk, remaining);
      const chunk = (this._flags.lastOutput = item.chunk(toProcess));

      if (!this.push(chunk, item.encoding)) {
        read = false;
      }

      if (item.done) {
        this._mockData.shift();
      }

      count += toProcess;
    }
  }

  setRawMode() {
    return this;
  }

  private endReadable() {
    // Synchronously emit an end event, if possible.
    if (!this._readableState.length) {
      this._readableState.ended = true;
      this._readableState.endEmitted = true;
      this.readable = false;
      this.emit('end');
    }
  }

  private drainData() {
    const state = this._readableState;
    while (state.buffer.length) {
      const chunk = state.buffer.shift();
      if (chunk !== null && chunk !== undefined) {
        state.length -= chunk.length;
        this.emit('data', chunk);
        this._flags.emittedData = false;
      }
    }
  }
}

class MockData {
  pos = 0;
  done = false;

  constructor(private data: Buffer | string | null, public encoding?: string) {}

  get length() {
    if (Buffer.isBuffer(this.data)) {
      return this.data.length;
    } else if (typeof this.data === 'string') {
      return this.data.length;
    }
    return 0;
  }

  chunk(length: number) {
    if (this.pos <= this.length) {
      if (Buffer.isBuffer(this.data) || typeof this.data === 'string') {
        const value = this.data.slice(this.pos, this.pos + length);
        this.pos += length;
        if (this.pos >= this.length) {
          this.done = true;
        }
        return value;
      }
    }

    this.done = true;
    return null;
  }
}

export function mockProcessStdin() {
  const mock = new MockStdin(process.stdin);
  Object.defineProperty(process, 'stdin', {
    value: mock,
    configurable: true,
    writable: false,
  });
  return mock;
}
