import { ConfigBuilder } from '@verdaccio/config';
import { fork, type ChildProcess } from 'child_process';
import fs from 'fs';
import getPort from 'get-port';
import path from 'path';
import { removeTempDir, tmpdir } from './tmpdir';
import { spawn, importNanoSpawn, type SpawnError } from '../process/spawn';

const verdaccioUser = {
  username: 'fake',
  password: 'fake',
};

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
  private server?: ChildProcess = undefined;
  private port?: number = undefined;
  private startPort: number;
  private testName: string;
  private tempRoot: string | undefined;
  private isLoggedIn = false;

  constructor(filename: string) {
    this.testName = path.basename(filename, '.test.ts');
    if (!knownTests.includes(this.testName)) {
      throw new Error(`Please add ${this.testName} to knownTests in registry.ts`);
    }
    this.startPort = 4873 + knownTests.indexOf(this.testName) * portRange;
  }

  /**
   * Start the server and log in as the fake user if not already logged in.
   */
  public async start(): Promise<unknown> {
    if (this.server) {
      throw new Error('Server already started');
    }

    if (this.port) {
      // We've already successfully used this port, so it will most likely work again.
      return this.startWithPort(this.port);
    }

    // get-port will throw an error if none are free.
    // If this is consistently having problems, probably it's best to increase portRange.
    const maxPort = this.startPort + portRange;
    console.log(`Looking for free ports in range ${this.startPort} to ${maxPort}`);
    const tryPort = await getPort({ port: getPort.makeRange(this.startPort, maxPort) });

    // Try to start the server. If it fails, it's likely a config error or something where a retry
    // won't be helpful, so just let it throw.
    await this.startWithPort(tryPort);
    this.port = tryPort;

    // Something about npm 8 makes publishing fail with anonymous access, so log in with a fake user
    if (this.isLoggedIn) {
      console.log('already logged in');
      return;
    }

    const registry = this.getUrl();
    console.log(`logging in to ${registry}`);

    try {
      // Use nano-spawn directly here for sending stdin lines (nano-spawn also supports async
      // iteration over output lines, but that seems to interfere with sending stdin to the
      // node child process, so just use the old approach)
      const nanoSpawn = await importNanoSpawn();
      const npm = nanoSpawn('npm', ['adduser', '--registry', registry], { cwd: process.cwd() });
      // for some reason there's no way to supply the username, password, and email besides stdin
      const npmProcess = await npm.nodeChildProcess;
      npmProcess.stdout?.on('data', chunk => {
        const chunkStr = String(chunk);
        if (chunkStr.includes('Username:')) {
          npmProcess.stdin?.write(verdaccioUser.username + '\r\n');
        } else if (chunkStr.includes('Password:')) {
          npmProcess.stdin?.write(verdaccioUser.password + '\r\n');
        } else if (chunkStr.includes('Email:')) {
          npmProcess.stdin?.write('fake@example.com\r\n');
        }
      });
      await npm;
      console.log('logged in');
      this.isLoggedIn = true;
    } catch (err) {
      throw new Error(`Error logging in to registry: ${(err as Error).stack || err}\n${(err as SpawnError).stderr}`);
    }
  }

  /** Run `npm logout` on the fake registry */
  public async logout(): Promise<void> {
    // Conservatively set to false even if it fails partway (logging in again is harmless)
    this.isLoggedIn = false;
    try {
      const registry = this.getUrl();
      await spawn('npm', ['logout', '--registry', registry], { cwd: process.cwd() });
    } catch {
      console.warn('Logging out of registry failed');
    }
  }

  /** Delete the temp directory used for the config file. */
  public cleanUp(): void {
    this.tempRoot && removeTempDir(this.tempRoot);
    this.tempRoot = undefined;
  }

  private async startWithPort(port: number): Promise<void> {
    this.tempRoot ??= tmpdir({ prefix: 'beachball-registry-' });
    const configName = 'config.yaml';
    const configPath = path.join(this.tempRoot, configName);
    if (!fs.existsSync(configPath)) {
      this.writeConfig(configPath);
    }

    return new Promise((resolve, reject) => {
      let hasReturned = false;
      const rejectWrapper = (err: unknown) => {
        !hasReturned && reject(err instanceof Error ? err : new Error(String(err)));
        hasReturned = true;
      };

      try {
        const verdaccioBin = require.resolve('verdaccio/bin/verdaccio');
        this.server = fork(verdaccioBin, ['--listen', String(port), '--config', `./${configName}`], {
          cwd: this.tempRoot,
          stdio: 'pipe',
        });

        this.server.on('message', (msg: { verdaccio_started: boolean }) => {
          if (msg.verdaccio_started) {
            hasReturned = true;
            resolve();
          } else {
            rejectWrapper(new Error(`unexpected message from verdaccio: ${JSON.stringify(msg)}`));
          }
        });

        this.server.stderr?.on('data', data => {
          const dataStr = String(data);
          if (!dataStr.includes('Debugger attached')) {
            rejectWrapper(new Error(dataStr));
          }
        });

        this.server.on('error', error => {
          rejectWrapper(error);
        });
      } catch (err) {
        rejectWrapper(err);
      }
    });
  }

  stop(): void {
    if (this.server) {
      this.server.kill();
      this.server = undefined;
    }
  }

  /**
   * Reset the state of the registry to an empty registry. Starts server if not already started.
   */
  public async reset(): Promise<void> {
    // Since we're running in memory we can just restart the server.
    this.stop();
    await this.start();
  }

  /**
   * A helper to get registry URL based on currently used port.
   */
  public getUrl(): string {
    if (!this.port) {
      throw new Error(`Can't getRegistryUrl, no valid port assigned.`);
    }
    return `http://localhost:${this.port}`;
  }

  /** Write the verdaccio config to the temp directory */
  private writeConfig(configPath: string): void {
    const configBuilder = ConfigBuilder.build({
      // Something about npm 8 makes publishing fail with anonymous access--from debugging, it might be trying
      // to read the package from the registry before publishing it, and verdaccio doesn't handle that well.
      // To work around this, add fake user info, which is also used in registry.ts to authenticate.
      auth: {
        // This uses verdaccio-auth-memory
        'auth-memory': {
          users: { fake: verdaccioUser },
        },
      },
      // This is the old anonymous access config--it still works for accessing packages, but not for publishing
      packages: {
        '**': {
          access: ['$anonymous'],
          publish: ['$anonymous'],
        },
      },
      store: {
        // This uses verdaccio-memory
        memory: { limit: 1000 },
      },
    });

    // set VERDACCIO_LOG env to write a log file
    if (process.env.VERDACCIO_LOG) {
      configBuilder.addLogger({
        type: 'file',
        level: 'trace',
        format: 'file',
        // @ts-expect-error -- this is missing from the types?
        path: path.join(process.cwd(), `verdaccio-${Date.now()}.log`),
      });
    }

    fs.writeFileSync(configPath, configBuilder.getAsYaml());
  }
}
