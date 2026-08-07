# 四端兼容性规则

> 改动任何 API、路由、service、组件或 SQL 时必读。根规则 `AGENTS.md` 第 5、7 节已摘要；本文件给出完整差异矩阵、强制清单和对账脚本。

## 1. 四端差异矩阵

| 维度 | 开发版（Web） | 桌面版（Electron） | 移动端（Android Capacitor） | PWA 端（iOS Safari / 安卓 Chrome） |
| --- | --- | --- | --- | --- |
| 数据库 | SQLite（默认） | PG / Supabase | 本地 SQLite（CapacitorSQLite 插件） | sql.js WASM（IndexedDB 持久化） |
| 鉴权 | `AUTH_ENABLED=false` 全放行 | `AUTH_ENABLED=true` JWT | 跳过 | 跳过 |
| 前端构建 | `npm run build` | `npm run build` + PyInstaller + electron-builder | `npm run build` + cap sync + assembleDebug | `npm run build:pwa`（base=`/app/`） |
| 鉴权守卫 | `ProtectedRoute` 放行 | `ProtectedRoute` 要求 token | 不注册 `/login`，不挂 `ProtectedRoute` | 同移动端 |
| 路由模式 | `createBrowserRouter` | `createBrowserRouter` | `createHashRouter` | `createHashRouter`（部署在 `/app/` 子路径） |
| API 入口 | Flask `/api/v1/*` | Flask `/api/v1/*` | `http.ts` 拦截 → `mobileRouteHandler` 本地查询 | 同移动端，但 `mobileSqlite.ts` 走 sql.js 分支 |
| WebDAV | Flask 后端代理 | Flask 后端代理 | Capacitor 原生 fetch + Filesystem | Deno Deploy 代理 + IndexedDB |
| 测试入口 | `tests/api/test_smoke.py` + Playwright `route-health.spec.ts` | 同 Web | `scripts/test_mobile_routes.py` + `tests/mobile/smoke_test.py`（真机） | 复用 Web 端 `route-health.spec.ts`（代码一致，仅构建配置不同）；DNS / WebDAV 代理等环境依赖问题靠手动验证 |

权威源：`frontend-react/src/config/features.ts`、`frontend-react/src/utils/isDesktop.ts`、`frontend-react/src/services/http.ts`、`frontend-react/src/router/index.tsx`、`frontend-react/src/services/mobileRouteHandler.ts`。

## 2. 跨端改动强制触发条件

满足以下任意条件，**必须**执行第三节的对账脚本并按第四节清单检查：

1. 在 `backend/routes/**` 新增 / 修改 / 删除 `@bp.route`。
2. 在 `frontend-react/src/router/index.tsx` 新增 / 修改 / 删除路由项（含 `featureFlags` 条件注册）。
3. 在 `frontend-react/src/services/mobileRouteHandler.ts` 新增 / 修改 case 或 handler。
4. 在 `frontend-react/src/config/features.ts` 修改 featureFlag 默认值或新增 flag。
5. 在 `frontend-react/src/services/http.ts` 修改 `/api/v1/` 拦截逻辑。
6. 修改 `frontend-react/src/utils/isDesktop.ts` 的 `isMobileClient` / `isPwaClient` / `isDesktopClient`。
7. 新增页面引用了新的 `/api/v1/*` 端点。

## 3. 对账脚本（执行后必须无 ERROR）

| 脚本 | 检查内容 | 触发条件 |
| --- | --- | --- |
| `python scripts/check_api_contract.py` | 后端 `@bp.route` 注册的端点 vs `mobileRouteHandler.ts` case 分支；另校验关键算法（如复合来源均分）后端与移动端实现数量一致 | 改动后端 routes、mobileRouteHandler 或后端/移动端关键算法 |
| `python scripts/check_route_drift.py` | `router/index.tsx` 注册的路由 vs `route-health.spec.ts` 的 `PUBLIC_ROUTES` 列表 | 改动路由或 smoke 用例 |
| `python scripts/check_feature_flags.py` | `features.ts` 中声明的 flag 是否被实际使用；`desktopAndWebFlags` / `mobileFlags` 字段是否对称 | 改动 features.ts 或菜单 |
| `python scripts/check_mobile_routes_coverage.py` | `mobileRouteHandler.ts` 的 case 分支 vs `test_mobile_routes.py` 测试用例覆盖 | 改动 mobileRouteHandler case 或新增 case |
| `python scripts/test_mobile_routes.py` | mobileRouteHandler 关键 SQL 在本地 SQLite 上可执行 | 改动 mobileRouteHandler 或后端 SQL |
| `cd frontend-react && npm run test:smoke` | Playwright 路由健康检查（chunk 加载错误检测） | 改动 lazy 路由 |

CI（`.github/workflows/ci.yml`）在 push / PR 时自动跑前 4 个对账脚本（无数据库依赖，可在任意环境执行）；`test_mobile_routes.py` 因依赖本地 SQLite 数据，仅在本地或发版前手动触发。

## 4. 四端兼容性必查清单

改动前确认每一项：

### 4.0 新增业务报表 / 功能的全端默认原则（最高优先级）

- [ ] **新增业务报表默认应在全端提供**（开发版 Web / 桌面版 / 移动端 Android / PWA 端），不得自行对移动端/PWA 隐藏。
- [ ] **移动端禁用任何新业务报表前必须先征求用户确认**（如在 features.ts 置 `showXxx: false` 或加入 mobileRouteHandler 忽略列表），并说明禁用理由（如依赖桌面端专属能力、后端端点未移植等）。不得在用户不知情时擅自禁用。
- [ ] 仅当功能确实依赖桌面/Web 专属能力（如文件上传、对账桌面工作流、系统配置）时，才允许移动端禁用，且须在注释中写明原因。
- [ ] 若需禁用，同步更新 `mobileRouteHandler.ts`（或加入 `MOBILE_IGNORED_PREFIXES`）、`features.ts`、`router/index.tsx`、测试与对账脚本，保持跨端契约检查通过。

### 4.1 新增 API 端点

- [ ] `backend/routes/**` 加 `@bp.route` + 业务逻辑
- [ ] `app.py` 注册蓝图（如新蓝图）
- [ ] `frontend-react/src/services/mobileRouteHandler.ts` 加对应 case + handler
- [ ] 同步新增 `scripts/test_mobile_routes.py` 用例
- [ ] 跑 `python scripts/check_api_contract.py` 无 drift
- [ ] 若新端点用于新页面，按 4.2 处理路由

### 4.2 新增 / 修改前端路由

- [ ] `router/index.tsx` 的 `mainChildren` 加项
- [ ] 桌面端/Web 端是否需要 `ProtectedRoute`？移动端/PWA 不需要（自动跳过）
- [ ] 移动端不应渲染的页面（如仅 Flask 后端支持的功能）必须用 `featureFlags.showXxx` 条件注册
- [ ] `frontend-react/tests/smoke/route-health.spec.ts` 的 `PUBLIC_ROUTES` 同步新增项
- [ ] 跑 `python scripts/check_route_drift.py` 无 drift

### 4.3 修改 featureFlag

- [ ] `features.ts` 中 `desktopAndWebFlags` 和 `mobileFlags` 是否都需要该 flag
- [ ] `router/index.tsx` 中条件注册的路由是否仍正确
- [ ] `MainLayout.tsx` 中菜单显隐是否仍正确
- [ ] 跑 `python scripts/check_feature_flags.py` 无 ERROR

### 4.4 修改 SQL 查询逻辑

- [ ] 后端 `backend/routes/data/**` 改 SQL
- [ ] `mobileRouteHandler.ts` 对应 handler 同步改 SQL（**完全一致**，包括 WHERE 子句、ORDER BY、字段名）
- [ ] 跑 `python scripts/test_mobile_routes.py` 该端点用例通过
- [ ] 若 SQL 涉及新表或新字段，确认 `backend/models_v2.py` 已定义且导入层已支持
- [ ] 若新增 case，跑 `python scripts/check_mobile_routes_coverage.py` 确认已补对应测试

### 4.5 PWA 专属约束

- [ ] 不使用 Capacitor 插件（`@capacitor/preferences`、`@capacitor/filesystem`、`@capacitor-community/sqlite`）——PWA 端无 Capacitor runtime
- [ ] 若需持久化，用 `localStorage` / `IndexedDB`，并在 `isPwaClient()` 分支处理
- [ ] 涉及外部网络请求（非 `/api/v1/`）必须经 Deno Deploy 代理，不能直连坚果云
- [ ] 新增大文件下载（>5MB）必须用 `fetchWithTimeout`，避免移动网络挂起
- [ ] 写入 IndexedDB 前确认已调用 `navigator.storage.persist()`（在用户手势上下文中）

### 4.6 移动端专属约束

- [ ] 不使用浏览器-only API（`DecompressionStream` 除外，已确认 Android WebView 90+ 支持）
- [ ] Capacitor SQLite 操作顺序：`close → closeConnection → createConnection → deleteDatabase → closeConnection`（见 `project_memory.md`）
- [ ] `moveDatabasesAndAddSuffix` 必须传 `dbNameList: ['shengxintou.db']`（带 `.db` 后缀）
- [ ] `closeMobileDatabase` 必须无条件（不能 gate by `dbOpen` flag）

## 5. mobileRouteHandler 维护规约

`mobileRouteHandler.ts` 是后端 API 在移动端/PWA 端的等价实现。**SQL 必须与后端完全一致**，业务过滤逻辑（`_funnel_filters` 等）必须等价翻译。

- case 路径：去掉 `/api/v1/` 前缀，例如后端 `/api/v1/dashboard/core-metrics` 对应 case `'dashboard/core-metrics'`
- handler 命名：`handle<PageName><Action>`，例如 `handleDashboardCoreMetrics`
- 返回结构：必须与后端 `jsonify` 结构完全一致（key 名、嵌套层级、数据类型）
- SQL 中文字段名直接使用（与 `models_v2.py` 一致），不做转换
- 未实现的端点统一抛 `Mobile API not implemented: <path>`，不要静默返回空数据
- 文件头部注释维护"SQL 从后端 Python 手工翻译"的说明

### 5.1 KNOWN_DRIFT / KNOWN_UNTESTED 维护原则

对账脚本中的 `KNOWN_DRIFT`（API 未实现）和 `KNOWN_UNTESTED`（case 未补测试）是**历史遗留暂存区**，不是新增 drift 的逃生口：

- **新增端点/case 不允许加入此列表**，必须当场补实现或补测试。
- **历史 drift 补齐后**，从列表中删除对应条目，并在 commit message 中说明补齐的端点。
- **优先级标记**（`high` / `medium` / `low`）仅用于提示补齐顺序，不改变 CI 行为：所有 `KNOWN_*` 条目都不阻塞 CI，新增 drift 一律报错。
- 列表只增不减是退化信号：每次合并 PR 前确认是否能在本期内补齐至少一条 `high` 或 `medium` 条目。

## 6. 对账脚本输出格式约定

所有 `scripts/check_*.py` 脚本：

- 退出码 0 = 通过，1 = 有 drift / ERROR
- 输出格式：先打印检查范围，再打印 diff 表格（端点 / 路由 / flag | 后端 / 前端 / 状态），最后打印统计
- 不修改任何文件，只读检测
- 在 `scripts/pre-commit-check.bat` 中追加调用

## 7. 例外与不实现项

以下后端端点**故意不实现** mobileRouteHandler（移动端/PWA 不需要）：

- `/api/v1/upload*`（数据导入，仅桌面端）
- `/api/v1/webdav/*`（WebDAV 备份管理，仅桌面端）
- `/api/v1/version/*`（版本检查，仅桌面端）
- `/api/v1/system/self-update/*`（自更新，仅桌面端）
- `/api/v1/system/data-sync/*`（Supabase 同步，仅桌面端，且 Supabase 功能已封存）
- `/api/v1/data-reconciliation/*`（抖音青鸟对账，仅桌面端，移动端 features 禁用）
- `/api/v1/account-mapping*`（账号映射管理，仅桌面端，移动端 features 禁用）
- `/api/v1/config/*`（系统配置，仅桌面端）

`check_api_contract.py` 通过 `MOBILE_IGNORED_PREFIXES` 白名单识别这些例外，不报 drift。`KNOWN_DRIFT` 记录历史遗留的未实现端点（待逐步补齐），新增端点不允许加入此列表。
