# 测试、协作与交付规则

## 1. 验证原则

1. 先运行与改动最相关、最快的检查，再按风险扩大范围。
2. 测试只证明其覆盖的行为；不要用单个 smoke 支持“全功能正确”的结论。
3. 不为修复目标之外的失败做无关重构；记录并区分基线问题。
4. 命令是否成功以退出码和产物/状态复核为准，不只看 stdout 文案。
5. 规则或文档改动不需要运行无关全量 UI 功能测试，但规则检查必须通过。

## 2. 影响范围到验证命令

| 影响范围 | 必跑 | 条件性验证 |
| --- | --- | --- |
| `AGENTS.md`、`CLAUDE.md`、`docs/rules/` | `python scripts/check_rule_architecture.py`、`git diff --check` | 修改检查脚本时加 `py_compile` |
| Python 后端路由/查询 | `python -m unittest discover -s tests/api -v` | 新逻辑增加定向测试 |
| 模型/导入 | API smoke + 隔离数据库样例 | replace/append、主键、类型和已有库兼容 |
| 前端 TS/TSX | `npm run typecheck` | 页面/组件再跑 build |
| 前端样式或构建配置 | `npm run build` | lint、视觉检查 |
| 路由/lazy 页面 | typecheck/build + `npm run test:smoke` | 功能 spec |
| Bug 修复 | 最小回归用例 | 受影响模块更广测试 |
| CI/setup/release 脚本 | 对应语法检查和独立命令 | 在 CI 或安全沙箱验证副作用流程 |
| 发版 | `scripts/run-full-tests.bat` 或等价全量流程 | 便携包启动与 Release 产物 |

前端命令默认在 `frontend-react/` 目录运行。

## 3. 测试目录职责

- `tests/api/test_smoke.py`：只读、快速的 Flask test client API smoke。
- `frontend-react/tests/smoke/`：公开路由健康检查。
- `frontend-react/tests/functional/`：页面级功能测试，适合发版前执行。
- `frontend-react/tests/regression/`：历史 Bug 的最小回归用例。

不要在规则中硬编码测试数量；以测试发现结果和目录当前内容为准。

### 新增测试

- 每个新增核心 API 至少增加一条快速 smoke，验证成功响应和关键结构。
- 每个新增 lazy 公开路由增加路由 smoke。
- 每次修复可复现 Bug，在已有测试体系中增加最小回归用例。
- 冒烟测试不做昂贵业务断言、不写用户数据库、不依赖真实外部网络。
- 如果邻近模块没有任何测试基础设施，不为单次小改动引入全新测试框架。

## 4. 本地检查入口

### 快速提交前检查

`scripts/pre-commit-check.bat` 是 Windows 快速入口，执行规则架构检查、后端 API smoke 和前端构建。脚本有变更时，确保每个步骤只执行一次并保留真实退出码。

### 全量功能检查

`scripts/run-full-tests.bat` 用于发版前，包含后端、构建和 Playwright 功能测试。日常文档或局部修复不要默认运行全量流程。

### 开发服务

- `scripts/start-dev.bat` 检查端口并启动 Flask/Vite。
- `scripts/stop-dev.bat` 优先读取 PID 文件，再按端口回退停止。
- 日志和 PID 位于 `logs/`，均是本地产物，不提交。

## 5. CI

`.github/workflows/ci.yml` 在 push/PR 上至少覆盖：

- 规则架构检查。
- 后端 API smoke。
- 前端 typecheck、lint 和生产构建。
- setup 脚本语法检查。

修改 CI 时：

- 使用 lockfile 和 `npm ci`，保持 Node/Python 版本与工作流当前基线一致。
- 给 job 设置合理 timeout。
- 不在日志输出 secret。
- 新检查应独立、快速、错误信息可定位。
- Windows/PowerShell 与 Bash 语法分别在对应 shell 验证。

## 6. Git 与工作区安全

- 不回滚、覆盖或清理用户未提交改动。
- 提交前查看 `git status`、`git diff` 和 `git diff --cached`，确认边界。
- 不把 `.env`、数据库、上传文件、备份、日志、临时脚本、prototype 或测试截图加入索引。
- 不手改生成文件，尤其是 `frontend-react/src/types/api.ts`。
- 未经用户明确要求，不 commit、push、建分支、打 tag 或创建 PR。
- Git 操作成功后用 `git status` / `git log` / 远端状态复核，不只依赖命令文案。

## 7. PR 与协作

- 使用 `.github/ISSUE_TEMPLATE/` 和 `.github/PULL_REQUEST_TEMPLATE.md` 当前模板。
- PR 标题采用 `feat:`、`fix:`、`refactor:`、`docs:`、`chore:` 等 Conventional Commits 前缀。
- PR 影响范围和验证清单应与实际 diff 一致，不能机械全勾。
- 修改规则架构时运行自动检查，不再靠人工肉眼保证 `AGENTS.md` / `CLAUDE.md` 同步。
- merge/review 策略遵守仓库维护者和平台设置，Agent 不自行假设可 squash 或直接推 main。

## 8. 版本与发布

- 当前版本、发布日期、版本号进位规则和 changelog 的唯一权威源是 `version.json`。
- 普通功能开发不在规则文件追加“已落地”章节。
- 发版脚本 `scripts/release.bat` / `release.sh` 会修改版本、commit、tag 和 push，属于高副作用操作；只有用户明确要求发版时运行。
- 发布前先让用户补全 changelog，不接受脚本生成的“待补”占位条目作为正式发布说明。
- GitHub Actions release 负责前端构建、PyInstaller、便携包和 GitHub Release；不要并行手工制作另一套发布产物。
- Release 失败时先查看 Actions job 和产物阶段，不用本地临时 zip 掩盖流水线问题。

## 9. 文档交付

- README 只维护产品、安装、使用、使用、结构和面向使用者的文档索引。
- 规则只描述当前有效状态；版本历史进入 `version.json`，过期设计进入 `docs/_archive/`。
- 修改 `AGENTS.md` 或 `CLAUDE.md` 必须同步并运行规则检查。
- 文档提到文件、命令、端点和表时，至少通过当前仓库存在性或代码搜索交叉验证。
- 不把本地被 `.gitignore` 排除的 spec 当成已交付的版本化文档，除非项目明确选择该目录。

## 10. 移动端（Android）测试与调试

### 测试能力现状

Android 端目前**没有**自动化 UI 测试框架（Appium / Detox / WDIO 均未接入），也没有 Android Studio / Emulator / adb 工具链。移动端验证依赖真机安装 + 人工操作。

| 测试方式 | 状态 | 说明 |
| --- | --- | --- |
| `adb logcat` | 未配置 | 本机无 Android SDK，需要先下载 platform-tools（约 10MB） |
| Android Emulator | 未配置 | 需要 Android Studio + system image |
| Appium / WDIO | 未接入 | 重型，需要模拟器或真机先就绪 |
| 真机 + 错误浮层 | **已内置** | `main.tsx` 全局未捕获错误捕获器，移动端原生环境自动启用 |
| SQLite 路由单元测试 | 已有 | `scripts/test_mobile_routes.py` 验证 10 个路由 SQL |

### 移动端错误捕获器（内置）

`frontend-react/src/main.tsx` 在 `Capacitor.isNative() === true` 时自动注册：

- `window.addEventListener('error', ...)`：捕获同步错误
- `window.addEventListener('unhandledrejection', ...)`：捕获 Promise 异步错误

**行为**：
1. 完整 `error.stack` 写入 `localStorage.mobile_errors`（保留最近 10 条）。
2. 屏幕顶部弹出全屏黑色浮层，显示错误消息、时间、URL、完整堆栈。
3. 「复制全部」按钮：一键复制错误文本到剪贴板，方便用户反馈给开发。
4. 「清除并刷新」按钮：清空错误记录并重新加载页面。

**桌面端不启用**：Chrome DevTools 已足够，避免干扰开发。

### 调试流程（真机无 adb）

1. 打包新 APK → 真机安装 → 触发错误。
2. 错误浮层自动弹出 → 点「复制全部」→ 粘贴反馈给开发。
3. 开发根据 stack trace 定位代码位置，无需反复猜测 minified 变量名。

### 调试流程（有 adb，可选）

若已安装 Android platform-tools：

```powershell
adb logcat -c
adb install android\release\省心投-v<版本号>.apk
adb shell am start -n com.shengxintou.app/.MainActivity
adb logcat *:E
```

### 移动端打包验证清单

每次 `cap sync android` 后、`assembleDebug` 前，必须运行 `android/scripts/post-sync-patch.ps1`：

1. `AndroidManifest.xml`：`screenOrientation=landscape`
2. `strings.xml`：`app_name = 省心投`（非"省心投 BI"）
3. `styles.xml`：`windowFullscreen=true`（全屏沉浸式）
4. 插件 `build.gradle`：JDK 21 → 17
5. `settings.gradle`：阿里云 Maven 镜像
6. `gradle.properties`：`kotlin.compiler.execution.strategy=in-process` + `org.gradle.daemon=false`
7. `gradle-wrapper.properties`：腾讯云 Gradle 镜像
8. `database/shengxintou.db` → `app/src/main/assets/public/assets/databases/shengxintouSQLite.db`
9. `assembleDebug`（非 release，debug keystore 自动签名，可直接安装）
10. `Rename-ApkToChinese` 复制到 `android/release/省心投-v<版本号>.apk`

### 版本号与命名

- APK 文件名：`省心投-v<version.json 的 version>.apk`
- 应用名：`省心投`（非"省心投 BI"）
- versionCode：`major * 1000 + minor * 10 + patch`（从 `version.json` 计算）
- 签名方式：debug keystore（自动签名，可直接安装；未配置 release signingConfig）

### Capacitor bridge 初始化时序约束（关键）

**背景**：Capacitor native bridge 在 WebView 启动早期可能还没注入 `window.Capacitor`，JS 顶层同步代码此时读取 `window.Capacitor.isNative()` 会得到 undefined。这会导致：
- `isMobileClient()` 返回 false → 走 `createBrowserRouter`（非 HashRouter）→ 在 `file://`/`https://localhost` 下路由找不到
- 条件注册的错误捕获器被跳过 → 错误无人捕获 → 显示在 RouteErrorBoundary
- minified 后报 `me.some is not a function` 等 minified 变量名错误，无法定位

**约束**：
1. **错误捕获器无条件注册**：`main.tsx` 的 `window.addEventListener('error'/'unhandledrejection')` 不能用 `if (isMobile)` 包裹。桌面端 Chrome DevTools 也能看到，无害。
2. **`isMobileClient()` 多重兜底**：必须按顺序检查
   - `Capacitor.isNativePlatform()` / `Capacitor.getPlatform() === 'android'`（Capacitor 官方 API）
   - `window.androidBridge`（Capacitor Android bridge 注入的早期标志，比 `window.Capacitor` 完整初始化更早）
   - `window.Capacitor?.isNative?.()`（旧逻辑保留）
3. **router 的 `isMobile` 模块加载时求值风险**：`router/index.tsx` 顶层 `const isMobile = isMobileClient()` 在模块加载时一次性求值。若 main.tsx 加载早于 Capacitor 注入，这里也会是 false。需要确保 Capacitor 在 React 首次渲染前已注入（Capacitor 默认在 `DOMContentLoaded` 前注入，React `createRoot().render()` 通常在 Capacitor 之后，但需验证）。
4. **DB 初始化延迟检查**：`App.tsx` 的 `useEffect` 在渲染后执行，此时 Capacitor bridge 已就绪，`isMobileClient()` 可靠返回 true。不要在模块顶层同步调用 DB 初始化。

**验证方法**：每次 build 后检查入口 chunk 是否包含 `mobile-debug-overlay`、`unhandledrejection`、`androidBridge`、`isNativePlatform`、`getPlatform` 关键字。若缺失说明 tree-shake 错误。

**参考**：
- [Capacitor Android Troubleshooting](https://capacitorjs.com/docs/android/troubleshooting)（"Plugin Not Implemented" 章节提到 service worker 和 bridge 注入问题）
- Capacitor core `getPlatformId()` 源码：检查 `win.androidBridge` / `win.webkit.messageHandlers.bridge`

