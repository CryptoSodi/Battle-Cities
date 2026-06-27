const merge = require('webpack-merge');

const baseConfig = require('./base.config');

module.exports = merge(baseConfig, {
  mode: 'production',

  devServer: {
    contentBase: './dist',
    host: '192.168.1.15',
    https: true,
    port: 8081,
    public: '192.168.1.15:8081',
  },
});
