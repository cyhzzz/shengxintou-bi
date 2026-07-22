/**
 * Electron 主进程：spawn Flask 后端 + 创建 BrowserWindow 加载 http://127.0.0.1:5000
 *
 * 设计：
 * - 主进程启动时 spawn Python 子进程跑 app.py
 * - 等 /api/health 返回 200 后再创建窗口
 * - 窗口关闭 / app 退出时 taskkill 进程树
 * - 外链用系统浏览器打开，避免在 Electron 内导航
 */
import { app, BrowserWindow, shell, dialog, Menu } from 'electron';
import path from 'node:path';
import { startFlask, stopFlask, waitForFlaskHealthy, FLASK_BASE_URL } from './flask-manager';

let mainWindow: BrowserWindow | null = null;
let flaskChild: ReturnType<typeof startFlask> | null = null;

async function bootstrap(): Promise<void> {
  try {
    // 1. 启动 Flask 子进程
    flaskChild = startFlask();
    // 2. 等待健康检查通过（最多 60s，给 Flask 启动 + 数据库初始化足够时间）
    await waitForFlaskHealthy(60_000);
    // 3. 创建主窗口
    createWindow();
  } catch (err) {
    console.error('[Main] 启动失败:', err);
    dialog.showErrorBox(
      '省心投 BI 启动失败',
      `无法启动后端服务。\n\n${(err as Error).message}\n\n` +
        `请检查：\n` +
        `1. Python 解释器是否可用\n` +
        `2. .env 文件是否存在且配置正确\n` +
        `3. 5000 端口是否被占用\n` +
        `4. frontend-react/dist 是否已构建`
    );
    // 即使失败也要清理已启动的子进程
    stopFlask(flaskChild);
    app.quit();
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: '省心投 BI',
    backgroundColor: '#ffffff',
    icon: path.join(__dirname, '..', 'resources', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // 加载 Flask 托管的前端
  mainWindow.loadURL(FLASK_BASE_URL);

  // 外链用系统浏览器打开（Supabase Dashboard / GitHub 等）
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://127.0.0.1') || url.startsWith('http://localhost')) {
      return { action: 'allow' };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // 阻止 Electron 内导航到非本地 URL（防误点外链跳走）
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (
      !url.startsWith('http://127.0.0.1') &&
      !url.startsWith('http://localhost') &&
      url !== FLASK_BASE_URL + '/'
    ) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 开发模式下打开 DevTools
  if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

// 用默认菜单（含 DevTools / Reload / 退出快捷键），方便调试
Menu.setApplicationMenu(null);

app.whenReady().then(bootstrap);

app.on('window-all-closed', () => {
  stopFlask(flaskChild);
  flaskChild = null;
  // macOS 上保持菜单栏活跃；Windows / Linux 直接退出
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // macOS：点 dock 图标重新创建窗口
  if (BrowserWindow.getAllWindows().length === 0) {
    bootstrap();
  }
});

// 应用退出前确保 Flask 子进程被杀掉
app.on('before-quit', () => {
  stopFlask(flaskChild);
  flaskChild = null;
});

// 处理 Ctrl+C / Ctrl+Break 信号
process.on('SIGINT', () => {
  stopFlask(flaskChild);
  app.quit();
});
process.on('SIGTERM', () => {
  stopFlask(flaskChild);
  app.quit();
});
