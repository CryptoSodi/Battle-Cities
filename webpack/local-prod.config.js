const merge = require('webpack-merge');

const devConfig = require('./dev.config');

module.exports = merge(devConfig, {
  mode: 'production',
  devtool: false,
});
