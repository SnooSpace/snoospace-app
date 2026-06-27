const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Prioritize js, jsx, cjs over ts, tsx to resolve third-party package issues
config.resolver.sourceExts = [
  'js', 'jsx', 'cjs', 'mjs', 'json', 'ts', 'tsx', 'scss', 'sass', 'css'
];

module.exports = config;
