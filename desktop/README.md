# 省心投 BI 桌面客户端（Electron 封装）

> A-lite 阶段：spawn 用户机器上的 Python 跑 `app.py`，Electron 主窗口加载 `http://127.0.0.1:5000`。
> 不用 PyInstaller 打包 Flask，简化首期交付。

## 目录结构

```text
desktop/
├── package.json               # Electron 项目配置
├── tsconfig.json              # TypeScript 配置
├── electron-builder.yml       # electron-builder 打包配置
├── .gitignore
├── src/
│   ├── main.ts                # 主进程
│   ├── preload.ts             # preload（最小化）
│   └── flask-manager.ts       # Flask 子进程管理
├── resources/
│   └── icon.ico               # 应用图标
└── README.md                  # 本文件
```

## 前置要求

- Node.js 20+
- Python 3.9+（必须能从命令行访问 `python.exe`，或在项目根的 `.venv/Scripts/python.exe` 或 `python-3.9-embed/python.exe`）
- 项目根的 `.env` 已配置（含 Supabase URL / KEY / DATABASE_URL / AUTH_ENABLED）
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
1. Electron 主进程 spawn `python app.py`
2. 轮询 `http://127.0.0.1:5000/api/health` 直到 200
3. 创建 BrowserWindow 加载 `http://127.0.0.1:5000`
4. 关闭窗口时 `taskkill /F /T /PID <flask_pid>` 杀进程树

## 打包

```powershell
cd desktop
npm run dist
```

产物在 `desktop/release/省心投 BI Setup 0.1.0.exe`（NSIS 安装包）。

如需便携版（解压即用，无安装向导）：

```powershell
npm run dist:portable
```

## 注意事项

### A-lite 阶段限制

1. **依赖用户机器上的 Python**：安装包不含 Python 解释器，需用户预装。
2. **依赖项目根的 `.venv`**：安装包会 copy `.venv` 进去，但用户机器若路径不同可能失效。
3. **Windows SmartScreen 拦截**：未签名 exe 启动时会提示"未知发行商"，点"仍要运行"即可。
4. **Flask 启动日志**：会输出到 Electron 主进程的 stdout，运行 `npm run dev` 时可见。

### 后续 A 阶段规划

- 用 PyInstaller 把 `app.py` 打包成 `server.exe`，与 Electron 安装包一起分发
- 用户机器零 Python 依赖
- 安装包大小预计 200MB+

## 故障排查

### `未找到 Python 解释器`

请准备以下任一环境：
1. `<项目根>/python-3.9-embed/python.exe`（便携 Python）
2. `<项目根>/.venv/Scripts/python.exe`（开发 venv）
3. 系统 PATH 中的 python.exe

### `等待 60000ms 后仍未就绪`

- 检查 5000 端口是否被占用：`netstat -ano | findstr :5000`
- 检查 `.env` 是否配置正确
- 手动跑 `python app.py` 看具体报错

### Flask 子进程残留

任务管理器找 `python.exe`，手动结束。
