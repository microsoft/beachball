import execa from 'execa';
import path from 'path';
// @ts-ignore
import fp from 'find-free-port';
import verdaccioUser from './verdaccioUser';

const verdaccioApi = require.resolve('./verdaccio.js');

/** Range of ports tried (increase this if the tests are failing due to ports unavailable) */
const portRange = 1000;
/**
 * Lists of tests known to use `Registry`. This is used to make each test try a different
 * port range to avoid collisions caused by race conditions with grabbing free ports.
 */
const knownTests = ['packagePublish', 'publishE2E', 'publishRegistry', 'syncE2E'];

// NOTE: If you are getting timeouts and port collisions, set jest.setTimeout to a higher value.
//       The default value of 5 seconds may not be enough in situations with port collisions.
//       A value scaled with the number of test modules using Registry should work, starting with 20 seconds or so.

export class Registry {
  private server?: execa.ExecaChildProcess = undefined;
  private port?: number = undefined;
  private startPort: number;
  private testName: string;

  constructor(filename: string) {
    this.testName = path.basename(filename, '.test.ts');
    if (!knownTests.includes(this.testName)) {
      throw new Error(`Please add ${this.testName} to knownTests in registry.ts`);
    }
    this.startPort = 4873 + knownTests.indexOf(this.testName) * portRange;
  }

  async start() {
    if (this.server) {
      throw new Error('Server already started');
    }

    if (this.port) {
      // We've already successfully used this port, so it will most likely work again.
      return this.startWithPort(this.port);
    }

    // find-free-port will throw an error if none are free.
    // If this is consistently having problems, probably it's best to increase portRange.
    const maxPort = this.startPort + portRange;
    console.log(`Looking for free ports in range ${this.startPort} to ${maxPort}`);
    const tryPort = await fp(this.startPort, maxPort);

    // Try to start the server. If it fails, it's likely a config error or something where a retry
    // won't be helpful, so just let it throw.
    await this.startWithPort(tryPort);
    this.port = tryPort;

    // Something about npm 8 makes publishing fail with anonymous access, so log in with a fake user
    try {
      const registry = this.getUrl();
      console.log(`logging in to ${registry}`);
      const npm = execa('npm', ['adduser', '--registry', registry]);
      // for some reason there's no way to supply the username, password, and email besides stdin
      npm.stdout!.on('data', chunk => {
        chunk = String(chunk);
        if (chunk.includes('Username:')) {
          npm.stdin!.write(verdaccioUser.username + '\r\n');
        } else if (chunk.includes('Password:')) {
          npm.stdin!.write(verdaccioUser.password + '\r\n');
        } else if (chunk.includes('Email:')) {
          npm.stdin!.write('fake@example.com\r\n');
        }
      });
      await npm;
      console.log('logged in');
    } catch (err) {
      throw new Error(
        `Error logging in to registry: ${(err as Error).stack || err}\n${(err as execa.ExecaError).stderr}`
      );
    }
  }

  private async startWithPort(port: number) {
    return new Promise((resolve, reject) => {
      try {
        // set VERDACCIO_LOG env to write a log file
        const logPath = process.env.VERDACCIO_LOG ? `verdaccio-${Date.now()}.log` : '';
        this.server = execa(process.execPath, [verdaccioApi, port.toString(), logPath]);
      } catch (err) {
        return reject(err);
      }

      if (!this.server || !this.server.stdout || !this.server.stderr) {
        return reject('server not initialized correctly');
      }

      this.server.stdout.on('data', data => {
        if (data.includes('verdaccio running')) {
          console.log(`Started registry for ${this.testName} on port ${port}`);
          resolve(port);
        }
      });

      this.server.stderr.on('data', data => {
        reject(data?.toString());
      });

      this.server.on('error', data => {
        reject(data);
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
