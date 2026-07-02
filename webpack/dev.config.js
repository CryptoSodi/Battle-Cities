const merge = require('webpack-merge');

const baseConfig = require('./base.config');

module.exports = merge(baseConfig, {
  mode: 'development',

  devtool: 'source-map',

  devServer: {
    contentBase: './dist',
    host: '192.168.100.19',
    https: true,
    public: '192.168.100.19:8080',
  },
});
