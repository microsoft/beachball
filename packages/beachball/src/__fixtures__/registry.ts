import { ConfigBuilder } from '@verdaccio/config';
import { fork, type ChildProcess } from 'child_process';
import execa from 'execa';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { removeTempDir, tmpdir } from './tmpdir';

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
const knownTests = ['packagePublish'];

// NOTE: If you are getting timeouts and port collisions, set jest.setTimeout to a higher value.
//       The default value of 5 seconds may not be enough in situations with port collisions.
//       A value scaled with the number of test modules using Registry should work, starting with 20 seconds or so.

export class Registry {
  private server?: ChildProcess = undefined;
  private port?: number = undefined;
  private startPort: number;
  private testName: string;
  private tempRoot: string | undefined;
  private debugMode: boolean;

  constructor(options: {
    testFilename: string;
    /** Enable verdaccio debug logs and log files */
    debugMode?: boolean;
  }) {
    this.testName = path.basename(options.testFilename, '.test.ts');
    this.debugMode = !!options.debugMode;
    if (!knownTests.includes(this.testName)) {
      throw new Error(`Please add ${this.testName} to knownTests in registry.ts`);
    }
    this.startPort = 4873 + knownTests.indexOf(this.testName) * portRange;
  }

  /**
   * Start the server but don't log in.
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

    const port: number[] = [];
    for (let i = this.startPort; i <= maxPort; i++) {
      port.push(i);
    }

    const getPort = await import('get-port');
    const tryPort = await getPort.default({ port });

    // Try to start the server. If it fails, it's likely a config error or something where a retry
    // won't be helpful, so just let it throw.
    await this.startWithPort(tryPort);
    this.port = tryPort;
  }

  /**
   * Log in as the fake user.
   */
  public async login(): Promise<void> {
    try {
      const registry = this.getUrl();
      console.log(`logging in to ${registry}`);
      const npm = execa('npm', ['login', '--registry', registry, '--verbose']);
      // If this is failing or hanging and you need to debug:
      //   npm.stdout?.pipe(process.stdout);
      //   npm.stderr?.pipe(process.stderr);
      // With Node 22+ and verdaccio 5, the npm login HTTP request fails for some reason.
      // This is fixed with latest verdaccio, which we can bump when bumping Node.

      // for some reason there's no way to supply the username, password, and email besides stdin
      npm.stdout?.on('data', chunk => {
        const chunkStr = String(chunk);
        if (chunkStr.includes('Username:')) {
          npm.stdin?.write(verdaccioUser.username + '\r\n');
        } else if (chunkStr.includes('Password:')) {
          npm.stdin?.write(verdaccioUser.password + '\r\n');
        } else if (chunkStr.includes('Email:') || chunkStr.includes('Email (')) {
          npm.stdin?.write('fake@example.com\r\n');
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

  /**
   * Run `npm whoami` on the fake registry.
   */
  public async whoami(): Promise<string | undefined> {
    try {
      const registry = this.getUrl();
      const result = await execa('npm', ['whoami', '--registry', registry]);
      return result.stdout.trim();
    } catch {
      return undefined;
    }
  }

  /**
   * Verdaccio regenerates its JWT signing secret on each start, so the token has to be re-acquired
   * after every restart. Login briefly, grab the token, then logout to remove auth from `.npmrc`.
   * The token itself remains valid in this verdaccio session (auth-memory doesn't track revocations),
   * and the unauthenticated tests can rely on no token being in `.npmrc`.
   */
  public async getToken(): Promise<string> {
    await this.login();

    const registryUrl = this.getUrl().replace(/^https?:/, '');
    const npmrcPath = path.join(os.homedir(), '.npmrc');
    const npmrcContent = fs
      .readFileSync(npmrcPath, 'utf-8')
      .split(/\r?\n/g)
      .find(line => line.startsWith(registryUrl) && line.includes('_authToken'));

    await this.logout();

    if (!npmrcContent) {
      throw new Error(`Failed to find auth token in .npmrc for registry ${registryUrl}`);
    }

    return npmrcContent.split('=')[1].replace(/"/g, '');
  }

  /** Run `npm logout` on the fake registry */
  public async logout(): Promise<void> {
    try {
      const registry = this.getUrl();
      await execa('npm', ['logout', '--registry', registry]);
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
          ...(this.debugMode && { env: { ...process.env, DEBUG: 'verdaccio:*' } }),
        });

        if (this.debugMode) {
          this.server.stdout?.pipe(process.stdout);
          this.server.stderr?.pipe(process.stderr);
        }

        this.server.on('message', (msg: { verdaccio_started: boolean }) => {
          if (msg.verdaccio_started) {
            hasReturned = true;
            resolve();
          } else {
            rejectWrapper(new Error(`unexpected message from verdaccio: ${JSON.stringify(msg)}`));
          }
        });

        this.server.stderr?.on('data', data => {
          if (this.debugMode) return;
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
          access: ['$authenticated'],
          publish: ['$authenticated'],
        },
      },
      store: {
        // This uses verdaccio-memory
        memory: { limit: 1000 },
      },
    });

    if (this.debugMode) {
      configBuilder.addLogger({
        type: 'file',
        level: 'trace',
        format: 'pretty',
        path: path.join(process.cwd(), `verdaccio-${Date.now()}.log`),
      });
    }

    fs.writeFileSync(configPath, configBuilder.getAsYaml());
  }
}
