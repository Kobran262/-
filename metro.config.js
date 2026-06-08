const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Whisper GGML models + Core ML assets
config.resolver.assetExts.push('bin', 'mil');

module.exports = withNativeWind(config, { input: './global.css' });
