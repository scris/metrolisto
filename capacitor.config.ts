import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tianzeds.ml',
  appName: '全地铁',
  webDir: 'dist',
  backgroundColor: '#f3f5f9',
  ios: {
    // CSS owns the safe-area spacing so the page background reaches every edge.
    contentInset: 'never',
  },
};

export default config;
