import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.shengxintou.mobile',
  appName: '省心投',
  webDir: '../frontend-react/dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1000,
      backgroundColor: '#ffffff',
      showSpinner: false,
    },
    // 启用原生 HTTP：patch window.fetch，请求经 OkHttp 发出，绕过 WebView CORS
    // 解决安卓端从 dav.jianguoyun.com fetch .db 时报 "fetch failed"
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
