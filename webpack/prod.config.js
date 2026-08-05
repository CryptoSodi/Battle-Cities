const { merge } = require('webpack-merge');

process.env.BATTLECITY_API_BASE_URL ||= 'https://api.battlecities.com';

const baseConfig = require('./base.config');

module.exports = merge(baseConfig, {
  mode: 'production',
});
