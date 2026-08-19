/**
 * Electron 主进程：spawn Flask 后端 + 创建 BrowserWindow 加载 http://127.0.0.1:5000
 *
 * 设计：
 * - 主进程启动时 spawn Python 子进程跑 app.py
 * - 等 /api/health 返回 200 后再创建窗口
 * - 窗口关闭 / app 退出时 taskkill 进程树
 * - 外链用系统浏览器打开，避免在 Electron 内导航
 */
import { app, BrowserWindow, shell, dialog, Menu, ipcMain } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { startFlask, stopFlask, waitForFlaskHealthy, FLASK_BASE_URL, resolveResourcesRoot } from './flask-manager';
import { applyFullUpdate } from './updater';

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

/**
 * 完整静默更新 IPC（v3.9.0）。
 *
 * updater:check-staging → { ready, version? }
 *   - 查询 resources/.update-staging/ 是否存在已下载的完整更新包
 * updater:apply → { ok, version?, error? }
 *   - 应用完整更新：停 Flask → 从 staging 替换 server/ + dist/ + version.json → 重启 Flask → 刷新窗口
 */
function registerUpdaterIpc(): void {
  ipcMain.handle('updater:check-staging', () => {
    try {
      const root = resolveResourcesRoot();
      const staging = path.join(root, '.update-staging');
      if (!fs.existsSync(path.join(staging, 'server', 'server.exe'))) return { ready: false };
      const raw = fs.readFileSync(path.join(staging, 'version.json'), 'utf-8');
      const version = String(JSON.parse(raw).version || '');
      return { ready: true, version };
    } catch {
      return { ready: false };
    }
  });

  ipcMain.handle('updater:apply', async () => {
    try {
      const root = resolveResourcesRoot();
      // 1. 先停 Flask（server.exe 运行时被占用，必须先停才能替换）
      if (flaskChild) {
        stopFlask(flaskChild);
        flaskChild = null;
      }
      // 2. 执行替换（staging → resources 三块），失败则保留现场
      const result = applyFullUpdate(root);
      if (!result.ok) {
        // 替换失败：尝试恢复 Flask，避免用户卡在无后端状态
        try {
          flaskChild = startFlask();
          await waitForFlaskHealthy(60_000);
        } catch { /* 后端恢复失败仅记日志 */ }
        if (mainWindow) mainWindow.loadURL(FLASK_BASE_URL);
        return { ok: false, error: result.error };
      }
      // 3. 替换成功：重启 Flask + 刷新窗口（等效"重启应用生效"）
      flaskChild = startFlask();
      await waitForFlaskHealthy(60_000);
      if (mainWindow) {
        mainWindow.loadURL(FLASK_BASE_URL);
      } else {
        createWindow();
      }
      return { ok: true, version: result.version };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });
}

app.whenReady().then(() => {
  registerUpdaterIpc();
  bootstrap();
});

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
