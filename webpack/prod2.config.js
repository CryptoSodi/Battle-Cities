const path = require('path');
const { merge } = require('webpack-merge');

const baseConfig = require('./local-prod.config');

module.exports = merge(baseConfig, {
  mode: 'production',

  devServer: {
    static: {
      directory: path.resolve(__dirname, '../dist'),
    },
    host: '192.168.1.15',
    server: 'https',
    port: 8081,
    allowedHosts: 'all',
  },
});
