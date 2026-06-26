// `CheckerPlugin` is optional. Use it if you want async error reporting.
// We need this plugin to detect a `--watch` mode. It may be removed later
// after https://github.com/webpack/webpack/issues/3460 will be resolved.
const { CheckerPlugin } = require('awesome-typescript-loader');
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
  },

  module: {
    rules: [
      {
        test: /\.ts$/,
        loader: 'awesome-typescript-loader',
      },
    ],
  },

  plugins: [
    new CheckerPlugin(),
    new CopyWebpackPlugin([
      { from: 'public/' },
      { from: 'data/', to: 'data/' },
      {
        from: 'External/web-gamepad-main/button_cluster.js',
        to: 'mobile-gamepad/button_cluster.js',
      },
      {
        from: 'External/web-gamepad-main/gamepad.js',
        to: 'mobile-gamepad/gamepad.js',
      },
      {
        from: 'External/web-gamepad-main/get_gamepads.js',
        to: 'mobile-gamepad/get_gamepads.js',
      },
      {
        from: 'External/web-gamepad-main/peer.js',
        to: 'mobile-gamepad/peer.js',
      },
      {
        from: 'External/web-gamepad-main/player.js',
        to: 'mobile-gamepad/player.js',
      },
      {
        from: 'External/web-gamepad-main/thumbstick.js',
        to: 'mobile-gamepad/thumbstick.js',
      },
      {
        from: 'External/web-gamepad-main/wakelock.js',
        to: 'mobile-gamepad/wakelock.js',
      },
      {
        from: 'External/web-gamepad-main/LICENSE',
        to: 'mobile-gamepad/LICENSE.txt',
      },
    ]),
  ],
};
