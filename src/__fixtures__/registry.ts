import execa from 'execa';
// @ts-ignore
import fp from 'find-free-port';
import verdaccioUser from './verdaccioUser';

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
  private server?: execa.ExecaChildProcess = undefined;
  private port?: number = undefined;

  async start() {
    if (this.server) {
      throw new Error('Server already started');
    }

    if (this.port) {
      // We've already successfully used this port, so we assume it will work again. (see comments above)
      return this.startWithPort(this.port);
    }

    // find-free-port will throw an error if none are free.
    // If this is consistently having problems, probably it's best to increase maxPort.
    const maxPort = defaultPort + 1000;
    console.log(`Looking for free ports in range ${defaultPort} to ${maxPort}`);
    const tryPort = await fp(defaultPort, maxPort);

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
