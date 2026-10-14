import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bunkerwatch.app',
  appName: 'Bunker Watch',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
