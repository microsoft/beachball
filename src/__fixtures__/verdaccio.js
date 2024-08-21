// This is a helper file to make it easier to tell when verdaccio successfully launches or fails to launch.
// Using verdaccio CLI has the same output whether it fails or succeeds, just one additional line if it fails,
// making it very hard to tell if it spawned correctly.
// @ts-ignore
const startServer = require('verdaccio').default;
const store = require('verdaccio-memory').default;

const [port, logFile] = process.argv.slice(2);
if (!port) {
  console.error('Please provide a port');
  process.exit(1);
}

const config = {
  // Something about npm 8 makes publishing fail with anonymous access--from debugging, it might be trying
  // to read the package from the registry before publishing it, and verdaccio doesn't handle that well.
  // To work around this, add fake user info, which is also used in registry.ts to authenticate.
  auth: {
    'auth-memory': {
      users: {
        fake: require('./verdaccioUser'),
      },
    },
  },
  // This is the old anonymous access config--it still works for accessing packages, but not for publishing
  packages: {
    '**': {
      access: '$anonymous',
      publish: '$anonymous',
    },
  },
  store: {
    memory: {
      limit: 1000,
    },
  },
  ...(logFile && {
    logs: [
      {
        type: 'file',
        level: 'trace',
        colors: false,
        path: logFile,
      },
    ],
  }),
};

const addr = {
  port: port,
  path: '/',
  host: 'localhost',
};

// @ts-ignore
startServer(config, port, store, '1.0.0', 'verdaccio', (webServer, addrs) => {
  webServer.listen(addr.port || addr.path, addr.host, () => {
    // This is logged to tell whoever spawns us that we're ready.
    console.log('verdaccio running');
    console.dir({ addrs });
  });
});
