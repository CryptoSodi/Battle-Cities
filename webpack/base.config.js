const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const { execFileSync } = require('child_process');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');

function getBuildVersion() {
  if (process.env.BATTLECITY_VERSION) {
    return process.env.BATTLECITY_VERSION;
  }

  try {
    const commitCount = execFileSync('git', ['rev-list', '--count', 'HEAD'], {
      cwd: projectRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return `0.1.${commitCount}`;
  } catch (_error) {
    return '0.1.dev';
  }
}

const buildVersion = getBuildVersion();

module.exports = {
  entry: {
    main: './src/main.ts',
    'player-profile': './src/playerProfile/main.ts',
  },

  output: {
    filename: '[name].js',
  },

  resolve: {
    alias: {
      '@battlecities/shared': require('path').resolve(
        __dirname,
        '../shared/src/index.ts',
      ),
    },
    extensions: ['.js', '.ts'],
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
      'process.env.BATTLECITY_VERSION': JSON.stringify(buildVersion),
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
