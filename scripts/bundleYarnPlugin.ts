import { build, type BuildResult } from 'esbuild';
import path from 'path';
import { findPackageRoot, findProjectRoot, getPackageInfo } from 'workspace-tools';

// These can be updated if needed, but the goal is to keep them low to reduce the parse time penalty
// on EVERY yarn command (even when the plugin isn't used).
const maxKbDev = 75;
const maxKbMin = 30;

const pluginPrefix = '@microsoft/beachball-yarn-plugin-';

/**
 * List of Yarn's built-in dynamic libraries (as of 4.17.0), which are externalized from the bundle.
 *
 * (`@yarnpkg/cli` exports `getDynamicLibs()` to get this, but it has a huge dep tree we don't need.
 * In practice it should only matter which deps our plugins use, but if you want to update the list
 * you can either download `@yarnpkg/cli` or look for that string in `.yarn/releases/yarn-*.cjs`.)
 */
const yarnDynamicLibs = [
  '@yarnpkg/cli',
  '@yarnpkg/core',
  '@yarnpkg/fslib',
  '@yarnpkg/libzip',
  '@yarnpkg/parsers',
  '@yarnpkg/shell',
  'clipanion',
  'semver',
  'typanion',
];

/** A handled/expected error (only message is logged) */
class BundleError extends Error {}

async function bundleYarnPlugin() {
  const packageRoot = findPackageRoot(process.cwd());
  const projectRoot = findProjectRoot(process.cwd());
  const packageInfo = packageRoot && getPackageInfo(packageRoot);

  if (!packageRoot || !packageInfo || packageRoot === projectRoot) {
    throw new BundleError('cwd must be under a plugin package directory');
  }

  const packageName = packageInfo.name;
  if (!packageName.startsWith(pluginPrefix)) {
    throw new BundleError(`package name must start with "${pluginPrefix}" (received: ${packageName})`);
  }

  try {
    await bundleSingle({ packageName, packageRoot, minify: false });
    await bundleSingle({ packageName, packageRoot, minify: true });
  } catch (err) {
    if ((err as BuildResult).errors) {
      console.error(`\n❌ Failed to bundle ${packageName} plugin`);
      process.exit(1);
    }
    throw err;
  }
}
async function bundleSingle(params: { packageName: string; packageRoot: string; minify: boolean }) {
  const { packageRoot, minify, packageName } = params;
  /** Short name of the plugin (e.g. "engines") */
  const shortName = packageName.replace(pluginPrefix, '');
  const outfile = path.join(packageRoot, 'dist', minify ? 'plugin.js' : 'plugin.dev.js');

  console.log(`\nBundling: ${outfile}`);

  const result = await build({
    entryPoints: [path.join(packageRoot, 'src/index.ts')],
    outfile,
    absWorkingDir: packageRoot,
    bundle: true,
    metafile: true,
    format: 'iife',
    globalName: 'plugin',
    platform: 'node',
    target: 'node22',
    // log errors, warnings, and a summary (which includes the output file sizes)
    logLevel: 'info',
    minify,
    // Wrap the bundle in the module shape Yarn expects for a plugin
    banner: {
      js: [
        `/* eslint-disable */`,
        `//prettier-ignore`,
        `module.exports = {`,
        `name: "@yarnpkg/plugin-${shortName}",`,
        `factory: function (require) {`,
      ].join('\n'),
    },
    footer: {
      js: [`return plugin;`, `}`, `};`].join('\n'),
    },
    plugins: [
      {
        // Plugin that mimics `@yarnpkg/builder`: mark Yarn's built-in dynamic libraries and any
        // `@yarnpkg/plugin-*` as external, so they're required from the host Yarn at runtime.
        name: 'dynamic-lib-resolver',
        setup(build) {
          build.onResolve({ filter: /.*/ }, args =>
            yarnDynamicLibs.includes(args.path) || /^@yarnpkg\/plugin-/.test(args.path)
              ? { path: args.path, external: true }
              : undefined
          );
        },
      },
    ],
  });

  const stats = Object.values(result.metafile.outputs)[0];
  const kb = Math.round(stats.bytes / 1024);
  const maxKb = minify ? maxKbMin : maxKbDev;
  if (kb > maxKb) {
    console.error(`❌ ${outfile} bundle size has increased: ${kb} KB (previous limit: ${maxKb} KB)`);
    console.log(
      'You can increase the size in scripts/bundleYarnPlugin.ts if needed, but first check the ' +
        'diff to see what changed and if anything can be removed.'
    );
    process.exit(1);
  }
}

bundleYarnPlugin().catch(err => {
  console.error(err instanceof BundleError ? err.message : (err as Error).stack || err);
  process.exit(1);
});
