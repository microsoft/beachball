import { ConfigBuilder } from '@verdaccio/config';
import { fork, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { findPackageRoot } from 'workspace-tools';
import { removeTempDir, tmpdir } from './tmpdir.ts';

const verdaccioUser = {
  name: 'fake',
  password: 'fake',
};

/** Range of ports tried (increase this if the tests are failing due to ports unavailable) */
const portRange = 1000;

// NOTE: If you are getting timeouts and port collisions, set jest.setTimeout to a higher value.
//       The default value of 5 seconds may not be enough in situations with port collisions.

export class Registry {
  private server?: ChildProcess = undefined;
  private port?: number = undefined;
  private tempRoot: string | undefined;
  private token: string | undefined;

  public constructor(private readonly startPort: number) {}

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

  /** Get a token for the fake user. */
  public async getToken(): Promise<string> {
    if (this.token) {
      return this.token;
    }

    try {
      const registry = this.getUrl();
      // There are issues with using stdin to script `npm login`, plus it's slow, so use the
      // registry API directly to get a token.
      // https://github.com/npm/registry/blob/main/docs/user/authentication.md#login
      const response = await fetch(`${registry}/-/user/org.couchdb.user:${verdaccioUser.name}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...verdaccioUser, type: 'user', roles: [], date: new Date().toISOString() }),
      });
      if (!response.ok) {
        throw new Error(`login request failed with ${response.status}: ${await response.text()}`);
      }
      const { token } = (await response.json()) as { token: string };
      if (!token) {
        throw new Error('login response did not include a token');
      }
      this.token = token;
      return this.token;
    } catch (err) {
      throw new Error(`Error logging in to registry: ${(err as Error).stack || err}`, { cause: err });
    }
  }

  /** Write the auth token to the user .npmrc so npm commands pick it up, or remove it if `token` is null. */
  private writeAuthToken(token: string | null): void {
    const npmrcPath = path.join(os.homedir(), '.npmrc');
    const npmrcContent = fs.existsSync(npmrcPath) ? fs.readFileSync(npmrcPath, 'utf-8') : '';
    const eol = npmrcContent.match(/\r?\n/)?.[0] ?? os.EOL;
    const authKey = `${this.getUrl().replace(/^https?:/, '')}/:_authToken`;
    const filtered = npmrcContent
      .trim()
      .split(/\r?\n/g)
      .filter(line => !line.startsWith(authKey));
    token && filtered.push(`${authKey}=${token}`);
    fs.writeFileSync(npmrcPath, filtered.join(eol) + eol);
  }

  /** Write the current token to `.npmrc` to emulate logging in. */
  public login(): void {
    if (!this.token) {
      throw new Error('No token available (login should have set it)');
    }
    this.writeAuthToken(this.token);
  }

  /** Clear the token from `.npmrc` to emulate logging out. */
  public logout(): void {
    this.writeAuthToken(null);
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
        // verdaccio has an exports map, so we can't resolve verdaccio/bin/verdaccio directly
        const verdaccioEntry = require.resolve('verdaccio');
        const verdaccioRoot = findPackageRoot(verdaccioEntry);
        if (!verdaccioRoot) {
          throw new Error(`Could not find verdaccio package root for ${verdaccioEntry}`);
        }
        const verdaccioBin = require.resolve(path.join(verdaccioRoot, 'bin/verdaccio'));
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
          if (!dataStr.includes('Debugger attached') && !dataStr.includes('Starting inspector')) {
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

  public stop(): void {
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
        format: 'pretty',
        path: path.join(path.dirname(configPath), `verdaccio-${Date.now()}.log`),
      });
    }

    fs.writeFileSync(configPath, configBuilder.getAsYaml());
  }
}
