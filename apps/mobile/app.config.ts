import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'LandConnect',
  slug: 'landconnect',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'landconnect',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: 'com.landconnect.app',
    supportsTablet: false,
    infoPlist: {
      NSCameraUsageDescription: 'LandConnect uses the camera for video calls and listing photos.',
      NSMicrophoneUsageDescription: 'LandConnect uses the microphone for voice and video calls.',
      UIBackgroundModes: ['audio', 'voip'],
    },
  },
  android: {
    package: 'com.landconnect.app',
    adaptiveIcon: { backgroundColor: '#14301F', foregroundImage: './assets/images/android-icon-foreground.png' },
    permissions: [
      'CAMERA',
      'RECORD_AUDIO',
      'MODIFY_AUDIO_SETTINGS',
      'BLUETOOTH_CONNECT',
      'ACCESS_NETWORK_STATE',
      'POST_NOTIFICATIONS',
      'VIBRATE',
    ],
    // Google Maps SDK key (Maps SDK for Android has no per-load fee). Without it the map renders blank on Android.
    config: { googleMaps: { apiKey: process.env.GOOGLE_MAPS_API_KEY } },
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    [
      'expo-splash-screen',
      { backgroundColor: '#F6F4EF', image: './assets/images/splash-icon.png', imageWidth: 120, dark: { backgroundColor: '#0D100F' } },
    ],
    ['expo-font', {}],
    ['expo-location', { locationWhenInUsePermission: 'Used to pin your land on the map and show plots near you.' }],
    ['expo-image-picker', { photosPermission: 'Used to add photos of your land.', cameraPermission: 'Used to take photos of your land.' }],
    ['expo-notifications', { color: '#1C6A4E' }],
    // Voice-call audio routing (earpiece/speaker/bluetooth, echo cancellation path) instead of media playback.
    ['@livekit/react-native-expo-plugin', { android: { audioType: 'communication' } }],
    '@config-plugins/react-native-webrtc',
    // Dev builds talk to the API over plain HTTP on the LAN.
    ['expo-build-properties', { android: { usesCleartextTraffic: true } }],
  ],
  experiments: { typedRoutes: true, reactCompiler: true },
  extra: { eas: { projectId: process.env.EAS_PROJECT_ID } },
};

export default config;
