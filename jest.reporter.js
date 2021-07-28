// @ts-check
const { clearLine, isInteractive } = require('jest-util');
const chalk = require('chalk');
const { BaseReporter } = require('@jest/reporters');
const Status = require('@jest/reporters/build/Status').default;
const getResultHeader = require('@jest/reporters/build/getResultHeader').defualt;
const getSnapshotStatus = require('@jest/reporters/build/getSnapshotStatus').default;
const { getConsoleOutput } = require('@jest/console');

const TITLE_BULLET = chalk.bold('\u25cf ');

class CustomReporter extends BaseReporter {
  /** @type {string} */
  _clear; // ANSI clear sequence for the last printed status
  /** @type {NodeJS.WriteStream['write']} */
  _err;
  _globalConfig;
  /** @type {NodeJS.WriteStream['write']} */
  _out;
  /** @type {Status} */
  _status;
  /** @type {Set<()=>void>} */
  _bufferedOutput;

  constructor(globalConfig) {
    super();
    this._globalConfig = globalConfig;
    this._clear = '';
    this._out = process.stdout.write.bind(process.stdout);
    this._err = process.stderr.write.bind(process.stderr);
    this._status = new Status();
    this._bufferedOutput = new Set();
    this._wrapStdio(process.stdout);
    this._wrapStdio(process.stderr);
    this._status.onChange(() => {
      this._clearStatus();
      this._printStatus();
    });
  }

  /**
   * @param {NodeJS.WritableStream | NodeJS.WriteStream} stream
   */
  _wrapStdio(stream) {
    const originalWrite = stream.write;

    /** @type {string[]} */
    let buffer = [];
    let timeout = null;

    const flushBufferedOutput = () => {
      const str = buffer.join('');
      buffer = [];

      // This is to avoid conflicts between random output and status text
      this._clearStatus();
      if (str) {
        originalWrite.call(stream, str);
      }
      this._printStatus();

      this._bufferedOutput.delete(flushBufferedOutput);
    };

    this._bufferedOutput.add(flushBufferedOutput);

    const debouncedFlush = () => {
      // If the process blows up no errors would be printed.
      // There should be a smart way to buffer stderr, but for now
      // we just won't buffer it.
      if (stream === process.stderr) {
        flushBufferedOutput();
      } else {
        if (!timeout) {
          timeout = setTimeout(() => {
            flushBufferedOutput();
            timeout = null;
          }, 100);
        }
      }
    };

    stream.write = chunk => {
      buffer.push(chunk);
      debouncedFlush();
      return true;
    };
  }

  // Don't wait for the debounced call and flush all output immediately.
  forceFlushBufferedOutput() {
    for (const flushBufferedOutput of this._bufferedOutput) {
      flushBufferedOutput();
    }
  }

  _clearStatus() {
    if (isInteractive) {
      if (this._globalConfig.useStderr) {
        this._err(this._clear);
      } else {
        this._out(this._clear);
      }
    }
  }

  _printStatus() {
    const { content, clear } = this._status.get();
    this._clear = clear;
    if (isInteractive) {
      if (this._globalConfig.useStderr) {
        this._err(content);
      } else {
        this._out(content);
      }
    }
  }

  onRunStart(aggregatedResults, options) {
    this._status.runStarted(aggregatedResults, options);
  }

  onTestStart(test) {
    this._status.testStarted(test.path, test.context.config);
  }

  onTestCaseResult(test, testCaseResult) {
    this._status.addTestCaseResult(test, testCaseResult);
  }

  onRunComplete() {
    this.forceFlushBufferedOutput();
    this._status.runFinished();
    process.stdout.write = this._out;
    process.stderr.write = this._err;
    clearLine(process.stderr);
  }

  onTestResult(test, testResult, aggregatedResults) {
    this.testFinished(test.context.config, testResult, aggregatedResults);
    if (!testResult.skipped) {
      this.printTestFileHeader(testResult.testFilePath, test.context.config, testResult);
      this.printTestFileFailureMessage(testResult.testFilePath, test.context.config, testResult);
    }
    this.forceFlushBufferedOutput();
  }

  testFinished(config, testResult, aggregatedResults) {
    this._status.testFinished(config, testResult, aggregatedResults);
  }

  printTestFileHeader(_testPath, config, result) {
    this.log(getResultHeader(result, this._globalConfig, config));
    if (result.console) {
      this.log('  ' + TITLE_BULLET + 'Console\n\n' + getConsoleOutput(result.console, config, this._globalConfig));
    }
  }

  printTestFileFailureMessage(_testPath, _config, result) {
    if (result.failureMessage) {
      this.log(result.failureMessage);
    }
    const didUpdate = this._globalConfig.updateSnapshot === 'all';
    const snapshotStatuses = getSnapshotStatus(result.snapshot, didUpdate);
    snapshotStatuses.forEach(this.log);
  }
}

CustomReporter.filename = __filename;

module.exports = CustomReporter;
