# 省心投 BI 桌面客户端（Electron + PyInstaller）

> 桌面版打包：Electron 外壳 + PyInstaller 打包的 server.exe + Supabase PostgreSQL 云端数据库。
> 用户机器零 Python 依赖，安装即用。

## 目录结构

```text
desktop/
├── package.json               # Electron 项目配置
├── tsconfig.json              # TypeScript 配置
├── electron-builder.yml       # electron-builder 打包配置（含 extraResources）
├── .gitignore
├── src/
│   ├── main.ts                # 主进程：spawn server.exe + 创建 BrowserWindow
│   ├── preload.ts             # preload（注入 window.desktop 标志）
│   └── flask-manager.ts       # Flask 子进程管理（启动 / 健康检查 / 退出清理）
├── resources/
│   └── icon.ico               # 应用图标
└── README.md                  # 本文件
```

## 架构

```text
用户启动 .exe
  ↓
Electron 主进程 (main.ts)
  ├─ spawn dist/server/server.exe（PyInstaller 产物，含 Python + Flask + backend）
  ├─ 轮询 http://127.0.0.1:5000/api/health 直到 200
  └─ 创建 BrowserWindow 加载 http://127.0.0.1:5000（Flask 托管 frontend-react/dist）
  ↓
用户关闭窗口
  └─ taskkill /F /T /PID <server_pid> 杀进程树
```

### 双端配置差异

单一代码库支持两种运行模式，仅配置不同：

| 模式 | 数据库 | 鉴权 | 配置文件 |
| --- | --- | --- | --- |
| Web 开发版 | SQLite（默认） | `AUTH_ENABLED=false` | `.env` |
| 桌面编译版 | Supabase PG | `AUTH_ENABLED=true` | `.env.desktop`（打包时重命名为 `.env`） |

- **前端运行时判断**：`window.desktop` 标志（preload 注入）控制菜单显隐 + ProtectedRoute
- **功能开关**：`frontend-react/src/config/features.ts` 集中管理 Web 版 vs 桌面版的功能显隐

## 前置要求

- Node.js 20+（Vite 7 要求）
- Python 3.9+（PyInstaller 打包用，用户机器不需要）
- NSIS（electron-builder 自动下载；若失败见下方故障排查）
- 项目根的 `.env.desktop` 已配置（含 Supabase URL / KEY / DATABASE_URL / AUTH_ENABLED=true）
- `frontend-react/dist/` 已构建（`cd frontend-react && npm run build`）

## 开发模式

```powershell
# 1. 安装依赖（首次）
cd desktop
npm install

# 2. 启动（先编译 TS 再起 Electron）
npm run dev
```

启动后：
1. Electron 主进程 spawn `python app.py`（开发版用项目根 .env，走 SQLite）
2. 轮询 `http://127.0.0.1:5000/api/health` 直到 200
3. 创建 BrowserWindow 加载 `http://127.0.0.1:5000`
4. 关闭窗口时 `taskkill /F /T /PID <flask_pid>` 杀进程树

## 打包

一键打包脚本（PyInstaller + 前端 build + electron-builder NSIS）：

```powershell
# 在项目根执行
.\scripts\build-installer.ps1
```

三阶段串行：
1. **PyInstaller** — `省心投-server.spec` 打包 `app.py` + backend + Python 依赖为 `dist/server/server.exe`
2. **前端 build** — `npm run build` 生成 `frontend-react/dist/`
3. **electron-builder** — 打 NSIS 安装包，extraResources 包含 server.exe / dist / backend / .env.desktop（重命名为 .env）/ version.json

产物：`desktop/release/省心投 BI Setup <version>.exe`

可选参数：

```powershell
.\scripts\build-installer.ps1 -SkipPyInstaller  # server.exe 已是最新
.\scripts\build-installer.ps1 -SkipFrontend     # dist/ 已是最新
.\scripts\build-installer.ps1 -OnlyNSIS         # 只跑 electron-builder
```

## 故障排查

### NSIS / winCodeSign 下载失败

脚本自动用国内镜像重试（`ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/`）。仍失败时：

1. 管理员身份运行打包脚本（winCodeSign 符号链接权限）
2. 开启 Windows 开发者模式（设置 → 隐私和安全性 → 开发者选项）
3. 失败时可退回绿色版（`desktop/release/win-unpacked/`，免安装直接运行）

### `等待 60000ms 后仍未就绪`

- 检查 5000 端口是否被占用：`netstat -ano | findstr :5000`
- 检查 `.env.desktop` 是否配置正确（Supabase 可达性）
- 手动跑 `dist/server/server.exe` 看具体报错

### Flask 子进程残留

任务管理器找 `server.exe` 或 `python.exe`（路径含 `省心投BI`），手动结束。

### Supabase 连接失败

- Supabase Auth API 访问可能受网络代理影响（尝试关闭代理或切换移动热点）
- PgBouncer transit 下 `prepared statement "_pg3_0" already exists` → `config.py` 已用 `prepare_threshold=None` 修复
