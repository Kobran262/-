import { ExpoConfig, ConfigContext } from 'expo/config';

function googleIosUrlScheme(clientId?: string): string | undefined {
  if (!clientId?.endsWith('.apps.googleusercontent.com')) return undefined;
  const prefix = clientId.replace('.apps.googleusercontent.com', '');
  return `com.googleusercontent.apps.${prefix}`;
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const googleClientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const googleScheme = googleIosUrlScheme(googleClientId);

  return {
  ...config,
  name: 'Srecha WMS',
  slug: 'srecha-wms',
  version: '1.1.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'srechawms',
  userInterfaceStyle: 'dark',
  ios: {
    bundleIdentifier: 'com.srecha.wms',
    buildNumber: '6',
    appleTeamId: '54VMCQN8D8',
    supportsTablet: false,
    infoPlist: {
      NSCameraUsageDescription: 'Для сканирования штрихкодов товаров',
      NSFaceIDUsageDescription: 'Для быстрого входа в приложение',
      ...(googleScheme
        ? {
            CFBundleURLTypes: [
              {
                CFBundleURLSchemes: [googleScheme],
              },
            ],
          }
        : {}),
    },
  },
  android: {
    package: 'com.srecha.wms',
    permissions: ['CAMERA', 'VIBRATE'],
    adaptiveIcon: {
      backgroundColor: '#0F0F0F',
      foregroundImage: './assets/images/android-icon-foreground.png',
    },
  },
  plugins: [
    './plugins/withSwiftConcurrencyFix.js',
    './plugins/withPrebuiltFrameworkDSYMs.js',
    'expo-router',
    'expo-sqlite',
    'expo-local-authentication',
    [
      'expo-camera',
      {
        cameraPermission: 'Для сканирования штрихкодов товаров',
      },
    ],
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        resizeMode: 'contain',
        backgroundColor: '#0F0F0F',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    FIREBASE_API_KEY: process.env.FIREBASE_API_KEY,
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
    GOOGLE_OAUTH_CLIENT_ID: process.env.GOOGLE_OAUTH_CLIENT_ID,
  },
};
};
