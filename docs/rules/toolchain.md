# 工具链与打包依赖

本规则记录三端打包所需的本地依赖工具、安装位置和命令入口。AI 在涉及打包或工具链任务前必读本文件。

## 1. 工具位置清单

仓库内置工具位于 `tools/`，全部被 `.gitignore` 排除，不入库；需要在新环境首次部署时手动下载。

| 工具 | 仓库内位置 | 用途 | 版本要求 | 下载来源 |
| --- | --- | --- | --- | --- |
| JDK 17 | `tools/jdk17/` | Android Gradle 编译 | 17.x（Temurin） | [adoptium.net/temurin/releases/?version=17](https://adoptium.net/temurin/releases/?version=17) |
| Android platform-tools | `tools/platform-tools/` | `adb` 真机调试 / 安装 APK | 35.x | [developer.android.com/tools/releases/platform-tools](https://developer.android.com/tools/releases/platform-tools) |
| Android SDK | `tools/android-sdk/` | `platforms`、`build-tools`、`cmdline-tools`（Gradle 编译需要） | platform 35 + build-tools 35.0.0 | `sdkmanager "platform-tools" "build-tools;35.0.0" "platforms;android-35"` |
| Gradle 缓存 | `android/gradle-home/` | 项目级缓存（避免沙箱拦截 `~/.gradle`） | - | `cap sync` 自动初始化 |
| Python 3.9+ | 系统 PATH 或 `python-3.9-embed/` | 后端运行 + PyInstaller 打包 | 3.9+ | [python.org](https://www.python.org/downloads/) |
| Node.js 20+ | 系统 PATH | 前端构建 + Capacitor | 20+ | [nodejs.org](https://nodejs.org/) |
| NSIS | 系统 PATH | Windows 安装包打包（桌面版） | 3.x | [nsis.sourceforge.io](https://nsis.sourceforge.io/Download) |
| PyInstaller | `.venv/`（`pip install`） | 打包 `server.exe`（桌面版） | 6.x | `pip install pyinstaller` |
| Appium | `.venv/` 或系统 | 移动端 smoke 测试（可选） | 2.x | `pip install appium appium-python-client` |

### 1.1 Android SDK 位置说明

`tools/android-sdk/` 存放完整 Android SDK（`platforms/`、`build-tools/`、`cmdline-tools`、`licenses`），被 `.gitignore` 排除不入库。

- Gradle 编译通过 `ANDROID_HOME` 环境变量定位 SDK；`cap sync` 和 `gradlew` 会自动探测。
- v3.5.4：SDK 从 `tmp/android-sdk/` 迁移到 `tools/android-sdk/`，避免 `tmp/` 被清理脚本误删导致编译失败。
- 若 `tools/android-sdk/` 丢失，Gradle 编译会失败并提示 "Failed to find target with hash string 'android-35'"。
- 恢复方式：见本文 [第 4 节 Android SDK 安装](#4-android-sdk-安装可选)。

### 1.2 工具丢失排查清单

AI 在执行打包命令前若遇到 "command not found" 或 "tool not found"：

1. JDK：`Test-Path "tools/jdk17/bin/java.exe"`；不存在则从 [adoptium.net](https://adoptium.net/temurin/releases/?version=17) 下载 zip 版解压到 `tools/jdk17/`。
2. adb：`Test-Path "tools/platform-tools/adb.exe"`；不存在则从 [Android platform-tools](https://developer.android.com/tools/releases/platform-tools) 下载 zip 解压到 `tools/platform-tools/`。
3. Android SDK：检查 `tools/android-sdk/platforms/android-35/` 是否存在；不存在则按第 4 节重装。
4. NSIS：`Get-Command makensis`；不存在则从 [nsis.sourceforge.io](https://nsis.sourceforge.io/Download) 安装并加入 PATH。

## 2. 三端打包命令

### 2.1 Web 开发版（无需打包）

```powershell
# 启动开发服务（Flask + Vite）
scripts\start-dev.bat
# 或手动启动
python app.py  # 后端
cd frontend-react && npm run dev  # 前端
```

### 2.2 桌面版（Electron + NSIS 安装包）

**前置**：Node.js 20+、Python 3.9+、NSIS。

```powershell
# 一键打包（PyInstaller + 前端 build + electron-builder NSIS）
.\scripts\build-installer.ps1

# 跳过已完成的阶段
.\scripts\build-installer.ps1 -SkipPyInstaller   # server.exe 已最新
.\scripts\build-installer.ps1 -OnlyNSIS           # 只重打 NSIS
```

**产物**：`release/省心投BI-Setup-x.y.z.exe`

**何时需要重新打包**：
- 后端 Python 代码变化（新增路由、修改模型、依赖更新）
- `省心投-server.spec` 变化
- `desktop/` Electron 配置变化
- electron-builder.yml 或 NSIS 脚本变化
- 前端单独 `npm run build` 不需要重打安装包（Flask 托管 dist/）

### 2.3 移动端（Android APK）

**前置**：Node.js 20+、JDK 17（`tools/jdk17/`）、Android SDK。

```powershell
# 一键打包（前端 build + cap sync + post-sync-patch + assembleDebug）
cd android
npm run build:apk

# 分步执行（调试时）
cd frontend-react && npm run build              # 1. 前端构建
cd ..\android && npm run sync                    # 2. cap sync + post-sync-patch
$env:JAVA_HOME = "D:\AIproject\省心投BI\tools\jdk17"
cd android && .\gradlew.bat assembleDebug --no-daemon  # 3. Gradle 编译
```

**产物**：`android/release/省心投-vX.Y.Z.apk`（debug 签名，可直接安装）

**何时需要重新打包**：
- 前端代码变化（任何 `frontend-react/src/` 修改）
- `capacitor.config.ts` 变化
- `android/scripts/post-sync-patch.ps1` 注入逻辑变化
- `mobileSqlite.ts` / `mobileSync.ts` / `mobileRouteHandler.ts` 变化
- 后端 API 变化（移动端走 SQLite 本地查询，但 mobileRouteHandler 需同步翻译新增端点）

**关键约束**（详见 `android/README.md`）：
- 必须用 `assembleDebug`（release buildType 无 signingConfig，输出未签名 APK 无法安装）
- `JAVA_HOME` 指向 `tools/jdk17/`（JDK 21 会导致插件 build.gradle 编译失败）
- `GRADLE_USER_HOME` 指向 `android/gradle-home/`（避免沙箱拦截 `~/.gradle`）
- `cap sync` 后必须运行 `post-sync-patch.ps1`（重新注入镜像/JDK17/全屏/横屏/内置DB/图标/中文名）
- **WebDAV 凭据安全（v3.6.0+）**：APK 不再内置 `WEBDAV_*` 凭据，`vite.config.ts` 已移除构建期 `define` 注入；用户在 App 内「数据同步」页面填写并经 `@capacitor/preferences` 持久化。根 `.env` 的 `WEBDAV_*` 仅桌面版后端消费，不会随 APK 打包。

## 3. Android 真机调试

### 3.1 adb 命令

```powershell
# 设置 PATH（PowerShell 当前会话）
$env:PATH = "D:\AIproject\省心投BI\tools\platform-tools;$env:PATH"

# 设备列表
adb devices

# 安装 APK
adb install -r "D:\AIproject\省心投BI\android\release\省心投-v3.5.4.apk"

# 启动 App
adb shell am start -n com.shengxintou.mobile/.MainActivity

# 查看日志（过滤错误）
adb logcat *:E

# 查看 WebView DevTools socket（CDP 调试用）
adb shell cat /proc/net/unix | findstr webview_devtools
```

### 3.2 Chrome DevTools Protocol（CDP）调试

WebView 启动后可在桌面 Chrome 调试：

```powershell
# 1. 找到 webview_devtools_remote socket
adb shell cat /proc/net/unix | findstr webview_devtools
# 输出格式：... @webview_devtools_remote_<PID>

# 2. 转发到本地端口
adb forward tcp:9222 localabstract:webview_devtools_remote_<PID>

# 3. 获取调试页面列表
Invoke-WebRequest -Uri "http://localhost:9222/json" -UseBasicParsing

# 4. 用 Chrome 打开返回的 devtoolsFrontendUrl，或用 WebSocket 连接 webSocketDebuggerUrl
```

### 3.3 移动端 smoke 测试（Appium）

```powershell
# 前置：pip install appium appium-python-client
# 启动 Appium Server
appium --allow-cors --port 4723

# 运行 smoke 测试
python tests\mobile\smoke_test.py
```

## 4. Android SDK 安装（可选）

若 `tools/android-sdk/` 丢失或新环境部署：

```powershell
# 1. 下载 cmdline-tools
# https://developer.android.com/tools#command-line-tools-only

# 2. 初始化 SDK
$env:ANDROID_HOME = "D:\AIproject\省心投BI\tools\android-sdk"
sdkmanager --sdk_root=$env:ANDROID_HOME "platform-tools" "build-tools;35.0.0" "platforms;android-35"

# 3. 接受许可
sdkmanager --licenses

# 4. 验证
Test-Path "D:\AIproject\省心投BI\tools\android-sdk\platforms\android-35\android.jar"
```

## 5. Python 便携版（桌面版打包用）

桌面版打包可能需要 Python 便携版（避免依赖系统 Python）：

- 位置：`python-3.9-embed/`（被 `.gitignore` 排除）
- 下载：[python.org 便携版](https://www.python.org/downloads/windows/)（Windows embeddable package）
- `scripts/build-installer.ps1` 会自动探测系统 Python 或便携版

## 6. 维护约定

- 工具版本要求变化时，先更新本文件，再更新 `android/README.md` 或 `scripts/build-installer.ps1` 注释。
- 新增工具时，在本文件登记位置、用途、版本、下载来源；不要散落到多个文档。
- `tools/` 下的工具全部 gitignore，不入库；新环境部署按本文件指引下载。
- 若工具位置迁移（如 `tmp/android-sdk/` → `tools/android-sdk/`），同步更新本文件和所有引用位置。
