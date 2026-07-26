const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: {
    main: './src/main.ts',
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
