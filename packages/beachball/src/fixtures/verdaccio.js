// This is a helper file to make it easier to tell when verdaccio successfully launches or fails to launch.
// Using verdaccio CLI has the same output whether it fails or succeeds, just one additional line if it fails,
// making it very hard to tell if it spawned correctly.
const startServer = require('verdaccio').default;
const store = require('verdaccio-memory').default;

const arguments = {
  port: process.argv[2],
};

const port = arguments.port;

if (!port) {
  console.error('Please provide a port');
} else {
  const config = {
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
  };

  const addr = {
    port: port,
    path: '/',
    host: 'localhost',
  };

  startServer(config, port, store, '1.0.0', 'verdaccio', (webServer, addrs, pkgName, pkgVersion) => {
    webServer.listen(addr.port || addr.path, addr.host, () => {
      // This is logged to tell whoever spawns us that we're ready.
      console.log('verdaccio running');
      console.dir({ addrs });
    });
  });
}
