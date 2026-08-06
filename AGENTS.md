# 省心投 BI — AI 编码规则

> 仓库根规则。`AGENTS.md` 与 `CLAUDE.md` 必须字节一致；修改后运行 `python scripts/check_rule_architecture.py`。
> 默认开发环境：Windows + PowerShell；本地工作目录通常为 `D:/AIproject/省心投BI`。

## 1. 指令与权威源

### 优先级

1. 当前会话的系统、开发者和用户明确指令。
2. 目标文件目录中更深层的 `AGENTS.md`（若存在）。
3. 本文件。
4. `docs/rules/` 中与任务相关的专题规则。
5. README、部署文档和历史设计。

### 单一权威源

- 当前版本、发布日期、版本号规则和 changelog：`version.json`。
- 产品定位、安装和使用：`README.md`。
- 当前业务与工程规则：`docs/rules/`。
- 主播类型映射：`backend/config/anchor_live_types.json`。
- 支持的数据导入类型：`backend/routes/upload.py::DATA_TYPES`。
- 业务表与中文列名：`backend/models_v2.py` 和上游源表。
- 生成 API 客户端：Orval 配置与生成命令；禁止手改 `frontend-react/src/types/api.ts`。
- `docs/_archive/` 和 `docs/*_legacy.md` 仅供历史查阅，不作为当前实现依据。

文档与实现冲突时，先以当前代码、配置、测试和 `version.json` 交叉验证，再修正文档；不要照搬历史说明。

## 2. 首次进入仓库

AI clone 或首次进入仓库时，先直接运行一键 setup，不逐项询问是否安装：

| 平台 | 命令 |
| --- | --- |
| Windows | `scripts\setup.bat` |
| macOS / Linux / WSL / Git Bash | `bash scripts/setup.sh` |
| 跨平台兜底 | `python scripts/setup.py` 或 `npm run setup` |

前置要求是 PATH 中已有 Python 3.9+ 和 Node.js 20+；脚本负责 `.venv`、依赖、前端构建和 `.env` 初始化。若当前会话已成功执行 setup，不重复运行。

## 3. 产品与数据边界

省心投 BI 是券商财富管理场景下的广告投放与开户转化分析平台，只负责：

```text
上游 ETL 文件 -> 原样入库 -> SQL 查询/聚合 -> React 报表展示
```

- 上游 ETL 负责业务 mapping、清洗、归一化、字段补全、漏斗预计算和口径修正。
- 本项目导入层只做空值、日期、布尔、超长 ID 等格式安全处理。
- 查询层可做 SELECT、SUM、GROUP BY、分页和兼容派生字段，不新增下游业务口径补丁。
- 新数据源必须走 `backend/processors/v2/raw_import.py`。
- 旧 v1 上传类型返回 `410 Gone`；禁止恢复旧 processor、旧表、旧原生前端和历史迁移链路。

## 4. 最高风险业务不变式

完整规则见 `docs/rules/business-invariants.md`。涉及漏斗、开户、资产、主播或应用市场时必须先读。

- **新开户优先**：新开户及引进资产是主产出；存量客户和存量资产单独作为辅助，不能混算。
- **内容平台非存量条件**：`是否为存量客户 == 0 OR IS NULL`；存量在有效线索之后剔除。
- **应用市场真实获客**：获客报表强制 `渠道类型 = 互联网引流`，统一使用 `_funnel_filters`。
- **禁止漏斗变平**：不能用 `WHERE 是否新开户 == 1` 过滤整条应用市场漏斗；“新开户”是“开户成功”之后的阶段。
- **主播映射**：JSON 是权威源，数据库表仅作启动同步后的查询缓存；不要直接改库维护。
- **青鸟导入**：`qingniao_leads` 按批次 append 是明确例外，其他 v2 类型默认 replace。`conversion_appmarket` 增量追加去重键 `设备号 + 下载日期`（详见 `docs/rules/business-invariants.md`）。
- **代理商映射**：映射来自 `dim_account` 的全称/简称/字母简称；不要恢复已删除的 `dim_vendor`。

## 5. 架构地图

### 后端

```text
app.py                         Flask、蓝图、SPA、中间件、主播映射同步
config.py                      环境变量与路径（DATABASE_URL 归一化 + AUTH_ENABLED 开关）
server_entry.py                PyInstaller 打包入口（仅桌面版构建用，开发版不引用）
backend/models.py              系统表
backend/models_v2.py           当前业务 ORM（含中文列）
backend/auth/                  JWT 本地鉴权（AUTH_ENABLED 开关控制）
backend/processors/v2/         唯一业务导入处理器（PG 用 COPY / SQLite 用 to_sql）
backend/routes/data/           通用查询与对账
backend/routes/reports/        全渠道、应用市场专题报表
backend/routes/system/         自更新、数据同步（SQLite ↔ PG 双向同步）
backend/scripts/               一次性脚本（SQLite→PG 迁移等）
backend/utils/                 异常、代理商、WebDAV、周报工具、方言辅助
```

- API 前缀：`/api/v1`。
- 数据库：`DATABASE_URL` 优先（PG/Supabase），未设走 SQLite（`DATABASE_PATH`）；`raw_import.py` 用 `is_pg` 判断自动走 COPY 或 to_sql。
- 鉴权：`AUTH_ENABLED=true` 启用 JWT 中间件（桌面版默认）；`false` 全放行（开发版默认）。
- Flask 生产时托管 `frontend-react/dist/`，SPA 深链接由 `serve_react_app` 兜底。
- `DoubleApiRewriteMiddleware` 兼容旧缓存产生的 `/api/api/...`。

### 前端

```text
frontend-react/src/router/      lazy 路由与旧路径重定向（ProtectedRoute 仅桌面版启用）
frontend-react/src/layouts/     主布局、菜单与滚动容器（featureFlags 控制菜单显隐）
frontend-react/src/pages/       报表与系统页面（含 Login 页面）
frontend-react/src/components/  共享组件（MetricCard / ReportFooter / FilterBar / Chart 等）
frontend-react/src/config/      功能开关（features.ts：Web 版 vs 桌面版显隐配置）
frontend-react/src/services/    HTTP（自动注入 Bearer token）、数据、上传、元数据、版本、auth
frontend-react/src/stores/      Zustand 状态（含 useAuthStore）；types/ 业务与生成类型；styles/ 维护 token
frontend-react/src/utils/       筛选、文本清洗、图表工具、环境判断（isDesktop）
```

### 桌面版（Electron）

```text
desktop/                        Electron 客户端（main.ts + preload.ts + flask-manager.ts）
desktop/electron-builder.yml    electron-builder 配置
省心投-server.spec + server_entry.py  PyInstaller 打包 server.exe（frozen 模式路径解析）
scripts/build-installer.ps1     三阶段打包脚本（PyInstaller + 前端 build + NSIS）
```

### 移动端（Android / Capacitor）

```text
android/                        Capacitor 根目录（capacitor.config.ts + package.json + scripts/）
android/android/                Android Studio 原生工程（cap sync 生成，cap sync 会覆盖配置）
android/scripts/post-sync-patch.ps1  cap sync 后注入镜像/JDK17/全屏/横屏/内置DB/图标/中文名
android/scripts/generate-icons.ps1   生成 ic_launcher 图标（50% 安全区防切割）
android/gradle-home/            项目级 Gradle 缓存（避免沙箱拦截 ~/.gradle）
android/release/                中文名 APK 输出（省心投-vX.Y.Z.apk）
frontend-react/src/services/mobileSqlite.ts / mobileSync.ts  CapacitorSQLite 直连 + 坚果云 WebDAV 同步（Filesystem Cache + moveDatabasesAndAddSuffix）
frontend-react/src/utils/isDesktop.ts        isMobileClient 三重兜底（isNativePlatform/getPlatform/androidBridge）
frontend-react/src/main.tsx                  动态 import App 等 Capacitor bridge 就绪再渲染
```

### 官网（GitHub Pages）

`website/` 静态页面（含三端下载入口）；`website/app.js` 调 GitHub API 直接触发最新 release 资产下载；`.github/workflows/pages.yml` 自动部署 website/ + frontend-react/dist/ 到 GitHub Pages（根路径官网，`/app/` 子路径 PWA）。

### 四端支持

单一代码库支持四种运行模式，仅配置不同，代码完全一致：
| 模式 | 数据库 | 鉴权 | 前端构建 | 打包 |
| --- | --- | --- | --- | --- |
| 开发版（Web） | SQLite（默认） | `AUTH_ENABLED=false` | `npm run build` | 无 |
| 桌面版（Electron） | PG/Supabase | `AUTH_ENABLED=true` | `npm run build` + PyInstaller + electron-builder | `scripts/build-installer.ps1` |
| 移动端（Android） | 本地 SQLite | 跳过鉴权（内置） | `npm run build` + cap sync + assembleDebug | `android/scripts/post-sync-patch.ps1` |
| PWA 端（iOS Safari） | IndexedDB + sql.js | 跳过鉴权 | `npm run build:pwa`（base=`/app/`） | GitHub Pages 自动部署（`.github/workflows/pages.yml`） |

- 数据库切换与鉴权：`.env` 设 `DATABASE_URL=postgresql+psycopg://...` 走 PG、`AUTH_ENABLED=true/false` 控制鉴权。
- 前端运行时判断：`window.desktop` 注入标志（`isDesktop.ts`）+ `features.ts` 控制菜单显隐与 ProtectedRoute。
- 打包脚本：桌面版 `scripts/build-installer.ps1`（Node.js 20+ + Python 3.9+ + NSIS）；移动端 `cd android && npm run build:apk`（JDK 17 + Android SDK + Node.js 20+）。
- 移动端/PWA 详细约束（Capacitor SQLite 顺序、HashRouter、sql.js、WebDAV 代理、IndexedDB persist）见 `docs/rules/cross-platform.md` 第 4 节。

## 6. 按任务读取规则

| 任务 | 必读 |
| --- | --- |
| 理解架构、增加模块/路由 | `docs/rules/overview.md` |
| 修改漏斗、开户、资产、主播、对账 | `docs/rules/business-invariants.md` |
| 修改 Flask、模型、导入、API、SQLite、WebDAV | `docs/rules/backend.md` |
| 修改 React、组件、筛选、类型、样式 | `docs/rules/frontend.md` |
| 跨端兼容（API/路由/featureFlag/SQL 同步） | `docs/rules/cross-platform.md` |
| 决定测试、CI、Git、发布 | `docs/rules/testing-and-delivery.md` |
| 打包、工具链、依赖工具位置 | `docs/rules/toolchain.md` |
| 新需求 | `docs/rules/workflows/feature.md` + `docs/rules/templates/tech-spec.md` |
| Bug 修复 | `docs/rules/workflows/bugfix.md` |

总导航和维护方式见 `docs/rules/README.md`。

## 7. 修改红线

- 先读后写：修改前读完整目标文件、调用方和同类实现。
- 只改需求范围，修根因，不夹带无关重构或清理。
- 不改 `models_v2.py` 中文列名来迎合前端。
- 不新增下游 mapping / 归一化 processor。
- 不手改生成文件；API 类型通过 `npm run generate:api` 更新。
- 报表头部指标统一使用 `MetricCard + MetricSection`；筛选器统一使用 `FilterBar`；既有特殊报表例外见前端规则。
- 数据源、端点和口径说明统一放 `ReportFooter`。
- Excel 脏文本展示前使用 `sanitizeText()`。
- 行级设备/线索明细提供 `Modal + Descriptions column={2}` 详情模式。
- 侧栏菜单实际滚动容器保持 `overflow-y: auto`。
- Flask 后台线程使用显式 application context，不直接依赖继承的 `current_app`。
- WebDAV 网络层错误为 `502 + UPSTREAM_UNAVAILABLE`；其他列表失败为 `500 + LIST_FAILED`。

## 8. 验证

从最相关检查开始，再按风险扩大：

| 改动 | 最小验证 |
| --- | --- |
| 规则架构 / 核心文件 | `python scripts/check_rule_architecture.py` + 通用验证 + `docs/rules/overview.md` 核心文件清单中该文件的额外验证 |
| Python 后端 | `python -m unittest discover -s tests/api -v` |
| 前端 TS/TSX | `cd frontend-react && npm run typecheck` |
| 前端页面/组件/样式 | typecheck + `npm run build` |
| lint 或大范围前端重构 | `npm run lint` |
| lazy 路由 | `npm run test:smoke` |
| 跨端契约（API/路由/flag/case） | `python scripts/check_api_contract.py` + `check_route_drift.py` + `check_feature_flags.py` + `check_mobile_routes_coverage.py`（详见 `docs/rules/cross-platform.md` 第 2 节触发条件） |
| 报表筛选器 | `python scripts/check_filter_bar_usage.py`（禁止手写 `<RangePicker>` + 自定义按钮；详见 `docs/rules/frontend.md` 第 9 节） |
| 移动端 SQLite 路由 | `python scripts/test_mobile_routes.py` |
| Bug 修复 | 对应最小回归用例 |
| 发版前 | `scripts/run-full-tests.bat` |

需用户手动触发的验证（AI 适时建议，不自行执行）：Windows 打包 `scripts\build-installer.ps1`（后端/Electron/NSIS 变化时）、Android APK `cd android && npm run build:apk`（`services/mobile*.ts`/`capacitor.config.ts`/移动端 UI 修复时）、Android smoke `python tests\mobile\smoke_test.py`（移动端崩溃/同步/路由修复后）、全链路测试 `scripts\run-full-tests.bat`（跨模块/发版前）。

详细 CI 清单、新报表测试同步清单、规则文档更新判断清单见 `docs/rules/testing-and-delivery.md` 第 11-13 节；工具链位置见 `docs/rules/toolchain.md`。

- 新核心 API 增加 `tests/api/test_smoke.py` smoke。
- 新 lazy 公开路由增加 `frontend-react/tests/smoke/route-health.spec.ts` 用例。
- 可复现 Bug 在现有测试体系中增加最小回归测试。
- 提交前运行 `scripts/pre-commit-check.bat`；全量功能测试只在发版或明确要求时运行。

## 9. Git、安全与交付

- 记录并保护用户已有未提交改动；不擅自回滚、清理、stash 或覆盖。
- 不提交 `.env`、数据库、上传文件、备份、日志、PID、prototype、临时脚本或测试截图。
- 未经用户明确要求，不 commit、push、建分支、打 tag、创建 PR 或发布。
- 发版脚本会修改版本、commit、tag 和 push；只有用户明确要求发版时运行。
- 版本历史只写入 `version.json`，不要在根规则追加“某版本已落地”章节。
- 规则变更后检查 `AGENTS.md` / `CLAUDE.md` SHA256、规则链接、`git diff --check` 和最终 Git 状态。

## 10. 文档维护

- 根规则只保留每次会话必读内容，目标控制在 200 行左右。
- 稳定业务/工程约束进入 `docs/rules/`，单个需求方案进入项目选定的 spec 目录。
- README 面向用户与贡献者；历史设计归档到 `docs/_archive/`。
- 不在规则中硬编码当前版本、测试数量、文件数量等高频变化事实。
- 更新规则前先确认权威源；同一动态信息只维护一份，其余位置链接引用。
