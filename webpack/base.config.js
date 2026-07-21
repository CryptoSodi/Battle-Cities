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
