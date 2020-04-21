import { ChildProcess, spawn } from 'child_process';
// @ts-ignore
import fp from 'find-free-port';

const verdaccioApi = require.resolve('./verdaccio.js');

const defaultPort = 4873;

// NOTE: If you are getting timeouts and port collisions, set jest.setTimeout to a higher value.
//       The default value of 5 seconds may not be enough in situations with port collisions.
//       A value scaled with the number of test modules using Registry should work, starting with 20 seconds or so.

export class Registry {
  // The biggest issue here is with tests launching in parallel creating registries, finding free ports,
  // and racing to grab ports they see as free. This means some tests will always fail on grabbing ports.
  // This class will attempt to find a free port, and once it does, continue using it, even through stops
  // and restarts. There's a theoretical chance of something grabbing the port between stops and restarts,
  // but probably not a practical concern.
  private server?: ChildProcess = undefined;
  private port?: number = undefined;

  async start() {
    if (this.server) {
      throw new Error('Server already started');
    }

    if (this.port) {
      // We've already successfully used this port, so we assume it will work again. (see comments above)
      return this.startWithPort(this.port);
    }

    let tryPort = defaultPort;

    while (!this.port) {
      // find-free-port will throw an error for us if none are free. No need to explicitly check.
      tryPort = await fp(tryPort, defaultPort + 10);

      try {
        await this.startWithPort(tryPort);
        this.port = tryPort;
      } catch {
        tryPort++;
        console.log(`Could not start server, trying again on port ${tryPort}`);
      }
    }
  }

  private async startWithPort(port: number) {
    return new Promise((resolve, reject) => {
      this.server = spawn(process.execPath, [verdaccioApi, port.toString()]);

      this.server.stdout.on('data', data => {
        if (data.includes('verdaccio running')) {
          resolve();
        }
      });

      this.server.stderr.on('data', data => {
        reject();
      });

      this.server.on('error', data => {
        reject();
      });
    });
  }

  stop() {
    if (this.server) {
      this.server.kill();
      this.server = undefined;
    }
  }

  /**
   * Reset the state of the registry to an empty registry. Starts server if not already started.
   */
  async reset() {
    // Since we're running in memory we can just restart the server.
    this.stop();
    await this.start();
  }

  /**
   * A helper to get registry URL based on currently used port.
   */
  getUrl() {
    if (!this.port) {
      throw new Error(`Can't getRegistryUrl, no valid port assigned.`);
    }
    return `http://localhost:${this.port}`;
  }
}
