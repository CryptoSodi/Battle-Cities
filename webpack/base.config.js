const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const versionPath = path.resolve(projectRoot, 'version.json');

function getBuildVersion() {
  if (process.env.BATTLECITY_VERSION) {
    return process.env.BATTLECITY_VERSION;
  }

  try {
    const version = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
    return `${version.major}.${version.minor}.${version.build}`;
  } catch (_error) {
    return '0.1.dev';
  }
}

const buildVersionDefinition = process.env.BATTLECITY_VERSION
  ? JSON.stringify(process.env.BATTLECITY_VERSION)
  : webpack.DefinePlugin.runtimeValue(
      () => JSON.stringify(getBuildVersion()),
      { fileDependencies: [versionPath] },
    );

module.exports = {
  entry: {
    admin: './src/admin/main.ts',
    main: './src/main.ts',
    'player-profile': './src/playerProfile/main.ts',
  },

  output: {
    // Content-hash the main entry so every release produces a fresh, never
    // cached URL. This is what makes over-the-air (no APK rebuild) updates
    // reliable: a new build = a new filename the CDN has never seen, so it
    // can never serve a stale copy. admin/player-profile are referenced by
    // their own static HTML and stay un-hashed on purpose.
    filename: (pathData) =>
      pathData.chunk.name === 'main'
        ? '[name].[contenthash].js'
        : '[name].js',
    // Remove stale emitted files (e.g. the previous main.js) so the manifest
    // and deployed output contain exactly the current build.
    clean: true,
  },

  resolve: {
    alias: {
      '@battlecities/shared': require('path').resolve(
        __dirname,
        '../shared/src/index.ts',
      ),
    },
    // The game source is TypeScript. Prefer it over any generated JavaScript
    // that may exist locally (for example from a headless TypeScript build),
    // otherwise webpack can mix ES5-transpiled subclasses with native ES
    // superclass constructors in the browser bundle.
    extensions: ['.ts', '.js'],
    fallback: {
      buffer: require.resolve('buffer/'),
      crypto: require.resolve('crypto-browserify'),
      stream: require.resolve('stream-browserify'),
    },
  },

  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        loader: 'ts-loader',
      },
    ],
  },

  plugins: [
    new webpack.DefinePlugin({
      'process.env.BATTLECITY_API_BASE_URL': JSON.stringify(
        process.env.BATTLECITY_API_BASE_URL || '',
      ),
      'process.env.BATTLECITY_VERSION': buildVersionDefinition,
    }),
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: 'process/browser',
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: 'public/', to: '.' },
        { from: 'data/', to: 'data/' },
      ],
    }),
  ],
};
