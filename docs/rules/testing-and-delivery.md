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
- **发布走本地手动流程**：`scripts/release.bat` / `release.sh` 只负责改版本号、commit、tag、push。push tag 后开发者在本机跑 `scripts\build-installer.ps1`（Windows） + `cd android && npm run build:apk`（Android）+ `gh release upload vX.Y.Z ...`。不要期望 CI 自动构建；不要并行手工制作另一套发布产物。
- Release 失败 / 找不到产物时，直接回头查本地 `logs/build-installer-vX.Y.Z.log` 和 `logs/build-apk-vX.Y.Z.log`，不再依赖 Actions 流水线。

## 9. 文档交付

- README 只维护产品、安装、使用、结构和面向使用者的文档索引。
- 规则只描述当前有效状态；版本历史进入 `version.json`，过期设计进入 `docs/_archive/`。
- 修改 `AGENTS.md` 或 `CLAUDE.md` 必须同步并运行规则检查。
- 文档提到文件、命令、端点和表时，至少通过当前仓库存在性或代码搜索交叉验证。
- 不把本地被 `.gitignore` 排除的 spec 当成已交付的版本化文档，除非项目明确选择该目录。

### 9.1 知识收尾与 neat-freak skill

- 跨会话收尾（文档/规则/记忆与代码现状对齐、会话残留清理）调用 `neat-freak` skill：当前用户系统已装，直接 `/neat` 或说"洁癖"触发即可，不要把 skill 文件内置进本项目。
- 未安装 `neat-freak` 的环境（如他人 fork 或新机器）：引导从 Agent Skills 平台安装，不要在仓库内保留 skill 副本（曾因放在 `tmp/neat-freak-skill/` 被误删）。
- skill 调用边界服从本仓库 `AGENTS.md` 与 `docs/rules/`：破坏性清理（删分支/worktree/临时库）必须先列清单等用户确认，未确认前不删。

## 10. 移动端（Android）测试与调试

### 测试能力现状

| 测试方式 | 状态 | 工具位置 | 说明 |
| --- | --- | --- | --- |
| `adb logcat` | ✅ 已配置 | `tools/platform-tools/adb.exe` | 真机日志、安装、CDP 调试 |
| Android Emulator | ❌ 未配置 | - | 需要 Android Studio + system image（重型，暂不引入） |
| Appium smoke | ✅ 已接入 | `tests/mobile/smoke_test.py` + `.venv` | NATIVE_APP + logcat 分析，6 个用例 |
| 真机 + 错误浮层 | ✅ 已内置 | `frontend-react/src/main.tsx` | 全局未捕获错误捕获器，移动端自动启用 |
| SQLite 路由单元测试 | ✅ 已有 | `scripts/test_mobile_routes.py` | 验证 10 个路由 SQL |
| Chrome DevTools (CDP) | ✅ 可用 | `adb forward` + Chrome | WebView 远程调试 |

工具链详细位置和安装方式见 [`toolchain.md`](toolchain.md)。

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

### 调试流程（真机 + adb）

`tools/platform-tools/adb.exe` 已就绪。详细命令见 [`toolchain.md`](toolchain.md) 第 3 节。

### 移动端打包验证清单

每次 `cap sync android` 后、`assembleDebug` 前，必须运行 `android/scripts/post-sync-patch.ps1`：

1. `AndroidManifest.xml`：`screenOrientation=landscape` + `largeHeap=true`
2. `strings.xml`：`app_name = 省心投`（非"省心投 BI"）
3. `styles.xml`：`windowFullscreen=true`（全屏沉浸式）
4. 插件 `build.gradle`：JDK 21 → 17
5. `settings.gradle`：阿里云 Maven 镜像
6. `gradle.properties`：`kotlin.compiler.execution.strategy=in-process` + `org.gradle.daemon=false`
7. `gradle-wrapper.properties`：腾讯云 Gradle 镜像
8. `database/shengxintou.db` → `app/src/main/assets/public/assets/databases/shengxintouSQLite.db`
9. `assembleDebug`（非 release，debug keystore 自动签名，可直接安装）
10. `Rename-ApkToChinese` 复制到 `android/release/shengxintou-v<版本号>.apk`

### 版本号与命名

- APK 文件名：`shengxintou-v<version.json 的 version>.apk`
- 应用名：`省心投`（非"省心投 BI"）
- versionCode：`major * 1000 + minor * 10 + patch`（从 `version.json` 计算）
- 签名方式：debug keystore（自动签名，可直接安装；未配置 release signingConfig）

### Capacitor bridge 初始化时序约束（关键）

**背景**：Capacitor native bridge 在 WebView 启动早期可能还没注入 `window.Capacitor`，JS 顶层同步代码此时读取 `window.Capacitor.isNative()` 会得到 undefined。

**约束**：
1. **错误捕获器无条件注册**：`main.tsx` 的 `window.addEventListener('error'/'unhandledrejection')` 不能用 `if (isMobile)` 包裹。
2. **`isMobileClient()` 多重兜底**：`Capacitor.isNativePlatform()` → `Capacitor.getPlatform() === 'android'` → `window.androidBridge` → `window.Capacitor?.isNative?.()`。
3. **router 的 `isMobile` 模块加载时求值风险**：`main.tsx` 动态 import App 等 Capacitor bridge 就绪（最多 500ms）再渲染。
4. **DB 初始化延迟检查**：`App.tsx` 的 `useEffect` 在渲染后执行，不在模块顶层同步调用。

## 11. 功能改造完成后的标准 CI 清单

每次功能改进或 Bug 修复完成后，AI 必须按以下清单执行验证，并主动建议用户触发手动验证项：

### 11.1 自动验证（AI 自行执行）

| 改动类型 | 必跑验证 | 命令 |
| --- | --- | --- |
| Python 后端 | API smoke | `python -m unittest discover -s tests/api -v` |
| 前端 TS/TSX | typecheck | `cd frontend-react && npm run typecheck` |
| 前端页面/组件/样式 | build | `cd frontend-react && npm run build` |
| 规则/文档 | 规则架构检查 | `python scripts/check_rule_architecture.py` |
| 后端新增/修改 API | API 契约对账 | `python scripts/check_api_contract.py` |
| 前端新增/修改路由 | 路由 drift 对账 | `python scripts/check_route_drift.py` |
| 修改 featureFlags | featureFlag 对账 | `python scripts/check_feature_flags.py` |
| 新增 mobileRouteHandler case | case 覆盖对账 | `python scripts/check_mobile_routes_coverage.py` |
| 前端新增/修改报表筛选器 | FilterBar 使用对账 | `python scripts/check_filter_bar_usage.py` |
| lazy 路由 | 路由 smoke | `cd frontend-react && npm run test:smoke` |
| Bug 修复 | 最小回归 | 对应 `tests/` 或 `frontend-react/tests/regression/` |
| lint 或大范围前端重构 | lint | `cd frontend-react && npm run lint` |

跨端对账脚本的详细触发条件见 [`cross-platform.md`](cross-platform.md) 第 2 节。

### 11.2 需用户手动触发的验证（AI 适时建议）

以下验证开销大或需要特定环境，**只在用户通知时执行**，但 AI 在以下场景应**主动建议**：

| 验证项 | 触发时机 | 命令 | AI 建议场景 |
| --- | --- | --- | --- |
| 端到端全链路功能测试 | 发版前 / 跨模块改动 | `scripts\run-full-tests.bat` | 改动涉及 3+ 页面、漏斗口径、数据导入流程 |
| Windows 桌面版编译打包 | 桌面版相关改动 | `scripts\build-installer.ps1` | 后端路由/模型变化、Electron 配置变化、`server_entry.py` 变化、NSIS 脚本变化 |
| Android APK 重新编译 | 移动端相关改动 | `cd android && npm run build:apk` | 前端 `services/mobile*.ts` 变化、`capacitor.config.ts` 变化、`post-sync-patch.ps1` 变化、移动端 UI 修复 |
| Android 真机 smoke | 移动端 Bug 修复后 | `python tests\mobile\smoke_test.py` | 移动端崩溃修复、SQLite 同步修复、路由修复 |

**AI 建议话术**：在交付说明末尾添加"建议触发"段落，例如：
> 本次改动涉及移动端 SQLite 同步逻辑，建议触发 Android APK 重新编译（`cd android && npm run build:apk`）并在真机验证同步流程。

### 11.3 何时不需要建议

- 纯文档改动 → 只跑规则架构检查
- 纯样式微调 → 只跑 typecheck + build
- 单个 bug 修复且无跨端影响 → 只跑对应回归测试
- 用户已明确表示"只改这一处" → 按最小验证执行，不主动建议打包

## 12. 新报表/新功能的测试同步清单

新增报表页面、新 API 端点或新数据导入类型时，必须**同步更新**以下测试体系。遗漏任一项会导致 CI 盲区。

### 12.1 新增后端 API 端点

| 必做 | 文件 | 说明 |
| --- | --- | --- |
| ✅ | `tests/api/test_smoke.py` | 增加该端点的 smoke 测试（成功响应 + 关键结构） |
| ✅ | `frontend-react/src/types/api.ts` | 通过 `npm run generate:api` 更新（禁止手改） |
| ✅ | 移动端 `mobileRouteHandler.ts` | 若移动端需要支持，增加 SQLite 翻译 + `scripts/test_mobile_routes.py` 用例 |
| ✅ | `python scripts/check_api_contract.py` | 跑对账脚本确认无新 drift（详见 `cross-platform.md` 第 4.1 节） |
| ⚠️ | `docs/rules/business-invariants.md` | 若涉及漏斗/开户/资产/主播口径，更新不变式 |

### 12.2 新增前端报表页面（lazy 路由）

| 必做 | 文件 | 说明 |
| --- | --- | --- |
| ✅ | `frontend-react/src/router/index.tsx` | 注册 lazy 路由 |
| ✅ | `frontend-react/src/layouts/MainLayout.tsx` | 增加菜单项（受 features.ts 控制） |
| ✅ | `frontend-react/tests/smoke/route-health.spec.ts` | 增加该路由的健康检查用例 |
| ✅ | `python scripts/check_route_drift.py` | 跑对账脚本确认路由与 smoke 用例对齐 |
| ✅ | `python scripts/check_feature_flags.py` | 若动了 `features.ts`，跑对账脚本确认声明与使用对齐 |
| ✅ | `frontend-react/tests/functional/<page>-functional.spec.ts` | 增加页面级功能测试 |
| ✅ | `frontend-react/src/config/features.ts` | 确定三端显隐（web/desktop/mobile） |
| ✅ | `python scripts/check_filter_bar_usage.py` | 确认筛选器使用 FilterBar 而非手写 RangePicker |
| ⚠️ | `mobileRouteHandler.ts` | 若移动端启用，增加对应 SQLite 查询 handler |

### 12.3 新增数据导入类型

| 必做 | 文件 | 说明 |
| --- | --- | --- |
| ✅ | `backend/routes/upload.py::DATA_TYPES` | 注册新类型 |
| ✅ | `backend/processors/v2/raw_import.py` | 增加 import handler |
| ✅ | `backend/models_v2.py` | 定义目标表（中文列名） |
| ✅ | `tests/api/test_smoke.py` | 增加导入 smoke |
| ✅ | 用户导入指南 | 仅含数据源路径，不含技术细节 |
| ⚠️ | `docs/rules/business-invariants.md` | 若涉及存量剔除/漏斗口径，更新不变式 |

### 12.4 新增移动端功能

| 必做 | 文件 | 说明 |
| --- | --- | --- |
| ✅ | `mobileRouteHandler.ts` | 增加对应 SQLite 翻译 |
| ✅ | `scripts/test_mobile_routes.py` | 增加 SQL 验证用例 |
| ⚠️ | `android/scripts/post-sync-patch.ps1` | 若需要新插件/权限/配置注入，更新 patch |
| ⚠️ | `tests/mobile/smoke_test.py` | 若有新的关键交互路径，增加 smoke 用例 |

## 13. 何时需要更新规则文档（判断清单）

功能改造完成后，AI 按以下清单判断是否需要更新 `docs/rules/` 下的规则：

| 改动类型 | 是否更新规则 | 更新哪个文件 |
| --- | --- | --- |
| 新增/修改业务口径（漏斗、开户、资产、主播） | ✅ 必须更新 | `business-invariants.md` |
| 新增数据导入类型 | ✅ 必须更新 | `backend.md` + `business-invariants.md` |
| 新增三端差异功能（featureFlag、移动端独有 SQL、PWA 专属约束） | ✅ 必须更新 | `cross-platform.md` + `features.ts` 注释 |
| 新增/修改后端 API（`@bp.route`）或 mobileRouteHandler case | ✅ 必须更新 | `cross-platform.md` 第 4.1/4.4 节，必要时更新 `backend.md` 第 4 节 |
| 新增/修改路由（`router/index.tsx`）或 `features.ts` 字段 | ✅ 必须更新 | `cross-platform.md` 第 4.2/4.3 节，必要时更新 `frontend.md` 第 8 节 |
| 新增依赖工具或工具位置迁移 | ✅ 必须更新 | `toolchain.md` |
| 新增/修改打包流程 | ✅ 必须更新 | `toolchain.md` + 对应 README |
| 新增/修改测试体系入口 | ✅ 必须更新 | `testing-and-delivery.md` |
| 新增公共组件契约（如 MetricCard、ReportFooter） | ✅ 必须更新 | `frontend.md` |
| 修改 API 前缀、鉴权、数据库切换等架构契约 | ✅ 必须更新 | `overview.md` |
| 单个 Bug 修复（无契约变化） | ❌ 不更新 | - |
| 单个页面 UI 微调 | ❌ 不更新 | - |
| 单个性能优化 | ❌ 不更新 | - |

**判断原则**：只有**稳定架构、公共契约、高风险不变式或工具链**变化时才更新规则；单次 Bug 的实现细节不自动升级为长期规则。

更新规则后必须：
1. 同步 `AGENTS.md` / `CLAUDE.md`（若根规则也受影响）
2. 运行 `python scripts/check_rule_architecture.py`
3. 确认 `git diff --check` 无空白错误

