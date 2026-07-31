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
    // v3.7.0：Capgo Capacitor Updater 配置
    //   - autoUpdate: false  关闭自动检查（避免触发 Capgo 服务器）
    //   - resetWhenUpdate: false  App 升级时不重置已下载的 bundle（保留热更新历史）
    //   - 协议：app 启动时调用 notifyAppReady() 标记当前 bundle 可用，
    //           若 10 秒内未调用，下次启动自动回退到上一个可用 bundle
    CapacitorUpdater: {
      autoUpdate: false,
      resetWhenUpdate: false,
    },
  },
};

export default config;
