// Learn more: https://docs.expo.dev/guides/customizing-metro
const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

/**
 * Web preview only: native-only modules (WebRTC, Google Maps, Keychain) are swapped for small stand-ins in
 * ./web-preview so the UI and backend flows can be clicked through in a browser. Android/iOS builds never see them.
 */
const WEB_STUBS = {
  '@livekit/react-native': 'livekit.tsx',
  'react-native-maps': 'maps.tsx',
  'expo-secure-store': 'secure-store.ts',
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && WEB_STUBS[moduleName]) {
    return { type: 'sourceFile', filePath: path.join(__dirname, 'web-preview', WEB_STUBS[moduleName]) };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
