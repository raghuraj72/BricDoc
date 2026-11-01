import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bricdoc.app',
  appName: 'BricDoc',
  webDir: '../frontend/out',
  server: {
    androidScheme: 'https',
    cleartext: false
  },
  android: {
    buildOptions: {
      keystorePath: 'release-key.keystore',
      keystoreAlias: 'bricdoc-key',
    }
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#4f46e5",
      showSpinner: false,
    }
  }
};

export default config;
