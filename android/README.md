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

- 设置环境变量 `ANDROID_HOME` 指向 SDK 根目录。**推荐使用项目内置 SDK**（`tools/android-sdk/`，避免 `tmp/` 误删导致编译失败）：

  ```powershell
  # PowerShell（当前会话临时生效）—— 项目内置 SDK（推荐）
  $env:ANDROID_HOME = "D:\AIproject\省心投BI\tools\android-sdk"
  # 或使用 Android Studio 默认安装路径
  # $env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
  # 永久生效（用户级）
  [System.Environment]::SetEnvironmentVariable("ANDROID_HOME", $env:ANDROID_HOME, "User")
  ```

- 建议将 `%ANDROID_HOME%\platform-tools` 与 `%ANDROID_HOME%\cmdline-tools\latest\bin` 追加到 `PATH`。
- 项目内置 SDK 位置和恢复方式见仓库根 `docs/rules/toolchain.md` 第 1.1 节与第 4 节。

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
3. 运行 `scripts/post-sync-patch.ps1` 注入镜像、JDK 17、全屏主题、横屏、内置 DB、应用图标等配置（cap sync 会覆盖这些）。
4. `./gradlew assembleDebug` 编译生成 Debug 签名 APK。

> ⚠️ **JDK 要求**：打包需 JDK 17（项目内置 `tools/jdk17/`），且必须设置 `JAVA_HOME` 和 `GRADLE_USER_HOME`（指向项目内 `android/gradle-home/` 避免用户目录写入被沙箱拦截）。详见 `scripts/post-sync-patch.ps1` 中的镜像和 Kotlin in-process 配置。

### 分步构建

```powershell
# 1. 构建前端
cd D:\AIproject\省心投BI\frontend-react
npm run build

# 2. 同步到 Android（含 post-sync-patch 自动注入配置）
cd D:\AIproject\省心投BI\android
npm run sync

# 3. 编译 APK（需先设置 JAVA_HOME 和 GRADLE_USER_HOME）
cd D:\AIproject\省心投BI\android\android
$env:JAVA_HOME = "D:\AIproject\省心投BI\tools\jdk17"
$env:GRADLE_USER_HOME = "D:\AIproject\省心投BI\android\gradle-home"
.\gradlew.bat assembleDebug
```

### APK 输出路径

构建完成后，原始 Debug APK 位于：

```text
android\android\app\build\outputs\apk\debug\shengxintou-v<version>.apk
```

`<version>` 从仓库根 `version.json` 读取（如 `shengxintou-v3.5.3.apk`）。

拼音名 APK 输出到 `android\release\shengxintou-v<version>.apk`（由 `build-apk.ps1` 复制重命名，`post-sync-patch.ps1` 中的 `Rename-ApkToChinese` 函数保持 shengxintou 拼音命名）。

> v3.5.3 起统一使用 `assembleDebug`（debug 签名）而非 `assembleRelease`，因为 release buildType 没配 `signingConfig`，输出未签名 APK 会导致安装报"包信息为空"。

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
├── release/                # 拼音名 APK 输出（shengxintou-vX.Y.Z.apk）
├── scripts/
│   ├── post-sync-patch.ps1  # cap sync 后注入镜像/JDK/全屏/DB/图标/重命名
│   └── generate-icons.ps1   # 生成 ic_launcher 图标（50% 安全区防止切割）
├── gradle-home/            # 项目级 Gradle 缓存（避免沙箱拦截 ~/.gradle）
└── README.md               # 本文档
```

## WebDAV 凭据安全（v3.6.0+）

> v3.6.0 起，APK 不再内置任何 WebDAV 凭据。开发环境根 `.env` 的 `WEBDAV_*` 不会被打包进 APK——`frontend-react/vite.config.ts` 已移除构建期 `define` 注入。

- **用户首次使用**：在 App 内「数据同步」页面点击「WebDAV 配置」按钮，填入坚果云服务器地址、账号和应用密码。
- **凭据持久化**：通过 `@capacitor/preferences` 存储于设备本地（应用沙箱内），卸载即清除。
- **未配置时**：同步按钮禁用并显示友好引导 Alert，不弹错误。
- **测试连接**：保存前先调用 `testWebDAVConnection` 验证服务器可达。
- **桌面端差异**：桌面版仍由后端 `backend/routes/webdav_backup.py` + `/api/v1/webdav/config` 端点管理 `.env`，前端 UI 写入；Android 不复用此端点（移动端无后端 Flask）。

凭据字段（持久化 key）：

| Preferences key | 说明 |
| --- | --- |
| `webdav_url` | WebDAV 服务器地址（默认 `https://dav.jianguoyun.com/dav/`） |
| `webdav_username` | 坚果云账号邮箱 |
| `webdav_password` | 应用密码（非登录密码） |
| `webdav_remote_dir` | 备份目录（可选，如 `shengxintou-backup`） |

实现入口：`frontend-react/src/services/mobileSync.ts` + `frontend-react/src/components/MobileSyncButton.tsx`。

## 说明

- 本目录仅负责将 `frontend-react` 构建产物封装为 Android 应用，不包含后端服务。
- 桌面版打包流程见仓库根 `scripts/build-installer.ps1`，与此处移动端构建相互独立。
- 如需修改应用 ID、名称或启动屏配置，编辑 `capacitor.config.ts`。
