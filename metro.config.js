const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    assetExts: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ttf', 'otf', 'woff', 'woff2'],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
