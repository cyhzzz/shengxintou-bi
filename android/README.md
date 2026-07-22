# 省心投 BI 移动端（Android）

基于 Capacitor 7 封装的前端 React 应用的 Android 移动端。

## 环境要求

### 1. 安装 JDK 17

- 下载并安装 [JDK 17](https://adoptium.net/temurin/releases/?version=17)（推荐 Eclipse Temurin）。
- 设置环境变量 `JAVA_HOME` 指向 JDK 安装目录，例如：

  ```powershell
  # PowerShell（当前会话临时生效）
  $env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-17.x.x+x"
  # 永久生效（用户级）
  [System.Environment]::SetEnvironmentVariable("JAVA_HOME", $env:JAVA_HOME, "User")
  ```

- 将 `%JAVA_HOME%\bin` 追加到 `PATH`。

### 2. 安装 Android SDK

- 安装 [Android Studio](https://developer.android.com/studio) 或仅安装 [Command-line tools](https://developer.android.com/tools)。
- 通过 Android Studio 的 SDK Manager 或 `sdkmanager` 安装以下组件：

  ```text
  platform-tools
  build-tools;35.0.0
  platforms;android-35
  ```

  命令行示例：

  ```powershell
  sdkmanager "platform-tools" "build-tools;35.0.0" "platforms;android-35"
  ```

- 设置环境变量 `ANDROID_HOME` 指向 SDK 根目录，例如：

  ```powershell
  # PowerShell（当前会话临时生效）
  $env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
  # 永久生效（用户级）
  [System.Environment]::SetEnvironmentVariable("ANDROID_HOME", $env:ANDROID_HOME, "User")
  ```

- 建议将 `%ANDROID_HOME%\platform-tools` 与 `%ANDROID_HOME%\cmdline-tools\latest\bin` 追加到 `PATH`。

### 3. Node.js 与依赖

- 需要 Node.js 20+（仓库根 `scripts/setup.bat` 已包含）。
- 在 `android/` 目录下安装 Capacitor 依赖：

  ```powershell
  cd D:\AIproject\省心投BI\android
  npm install
  ```

## 构建 APK

### 一键构建（推荐）

在 `android/` 目录下执行：

```powershell
npm run build:apk
```

该脚本依次完成：

1. 构建前端 React 资源（`frontend-react/dist`）。
2. `npx cap sync android` 同步 Web 资源与原生插件。
3. `./gradlew assembleDebug` 编译生成 Debug APK。

### 分步构建

```powershell
# 1. 构建前端
cd D:\AIproject\省心投BI\frontend-react
npm run build

# 2. 同步到 Android
cd D:\AIproject\省心投BI\android
npm run sync

# 3. 编译 APK
cd D:\AIproject\省心投BI\android\android
.\gradlew.bat assembleDebug
```

### APK 输出路径

构建完成后，Debug APK 位于：

```text
android\android\app\build\outputs\apk\debug\app-debug.apk
```

## 在 Android Studio 中打开

```powershell
cd D:\AIproject\省心投BI\android
npm run open
```

或直接用 Android Studio 打开 `android\android\` 目录。

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm install` | 安装 Capacitor 依赖 |
| `npm run build` | 构建前端并同步到 Android 工程 |
| `npm run build:apk` | 构建并生成 Debug APK |
| `npm run sync` | 仅同步 Web 资源到原生工程 |
| `npm run open` | 在 Android Studio 中打开工程 |

## 目录结构

```text
android/
├── android/                # Android Studio 原生工程（npx cap add android 生成）
├── capacitor.config.ts     # Capacitor 配置
├── package.json            # 依赖与脚本
└── README.md               # 本文档
```

## 说明

- 本目录仅负责将 `frontend-react` 构建产物封装为 Android 应用，不包含后端服务。
- 桌面版打包流程见仓库根 `scripts/build-installer.ps1`，与此处移动端构建相互独立。
- 如需修改应用 ID、名称或启动屏配置，编辑 `capacitor.config.ts`。
