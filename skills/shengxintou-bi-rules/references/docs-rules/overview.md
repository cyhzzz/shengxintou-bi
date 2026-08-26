# 项目与架构总览

## 产品边界

省心投 BI 是券商财富管理场景下的互联网广告投放与开户转化分析平台，职责是：

1. 接收上游 ETL 已加工的数据文件并安全落库。
2. 通过 SQL 查询、聚合和兼容派生字段提供报表数据。
3. 在 React 前端完成筛选、指标卡、图表、明细和导出展示。

项目**不负责**继续做业务 mapping、口径清洗、归一化、字段补全或漏斗预计算。格式层安全处理（空值、日期、布尔、超长 ID）属于导入边界，业务口径修正属于上游 ETL。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 后端 | Python、Flask、SQLAlchemy、pandas、SQLite |
| 前端 | React、TypeScript、Vite、Ant Design、ECharts、Ant Design Charts/Plots、Zustand |
| 测试 | Python `unittest` API smoke、Playwright 路由/功能/回归测试 |
| 桌面与发布 | Electron 客户端、PyInstaller 打包 server.exe、electron-builder NSIS 安装包；发布走 CI 自动打包（push tag 触发 `.github/workflows/release.yml`：gate 等 CI 全绿 → build-exe/build-apk → publish 挂载 release 资产），本地 `scripts/build-installer.ps1` / `cd android && npm run build:apk` 仅作调试回退 |

具体版本以 `requirements.txt`、`frontend-react/package.json` 和工作流配置为准，不在规则中复制。

## 核心数据流

```text
上游 ETL 文件
  -> POST /api/v1/upload
  -> backend.routes.upload 后台线程
  -> backend.processors.v2.raw_import.write_to_db
  -> SQLite 业务表
  -> Flask SELECT / SUM / GROUP BY / 分页
  -> React 报表、筛选、图表与导出
```

- 普通 v2 数据类型通过 `pandas.to_sql(if_exists='replace')` 全量替换。
- `qingniao_leads` 是明确例外：按批次标注写入 `fact_qingniao_leads`，使用 append 保留历史批次。
- 旧 v1 上传类型保留识别名但返回 `410 Gone`，不能复活旧 processor 或旧表链路。

## 后端模块

| 模块 | 职责 |
| --- | --- |
| `app.py` | Flask 应用、蓝图注册、SQLite 参数、SPA 兜底、主播映射同步、中间件 |
| `config.py` | 环境变量、路径、上传、WebDAV 和预留飞书配置 |
| `backend/models.py` | 数据导入日志和系统配置两张系统表 |
| `backend/models_v2.py` | 当前业务 ORM：账号、主播映射、两张转化明细、三张聚合表、青鸟对账表 |
| `backend/processors/v2/raw_import.py` | 当前唯一业务数据导入处理器 |
| `backend/routes/data/` | Dashboard、漏斗、线索、厂商、员工、小红书、对账等查询蓝图 |
| `backend/routes/reports/` | 全渠道和应用市场专题报表 |
| `backend/routes/system/` | Git 自更新、数据同步（SQLite ↔ PG 双向同步） |
| `backend/utils/` | 异常装饰器、代理商映射、WebDAV 和周报工具 |

### API 与 SPA

- API 前缀为 `/api/v1`。
- `DoubleApiRewriteMiddleware` 将旧缓存产生的 `/api/api/...` 兼容重写为 `/api/...`。
- `serve_react_app` 在非 API 路由匹配失败时返回 `frontend-react/dist/index.html`。
- Flask 显式提供生产静态资源；开发时 Vite `:3000` 代理 API 到 Flask `:5000`。

## 数据库

- 默认路径为 `database/shengxintou.db`，可通过 `DATABASE_PATH` 覆盖。
- 启动时注册 `models_v2` 并执行 `db.create_all()`。
- SQLite 使用 `journal_mode=DELETE`，不要改回 WAL；便携版曾因 WAL 外部文件产生损坏风险。
- 启动优化包括较大 cache、`synchronous=NORMAL`、`temp_store=MEMORY` 和 busy timeout；修改前读取 `app.configure_sqlite_optimization()` 当前实现。
- `backend/models_v2.py` 的中文列名与源表 / `to_sql` 结果对齐，不能为前端字段命名重写。

## 前端模块

| 模块 | 职责 |
| --- | --- |
| `frontend-react/src/router/` | Browser Router、lazy 页面、旧路径重定向 |
| `frontend-react/src/layouts/` | 主框架、菜单、顶部栏和滚动容器（featureFlags 控制显隐） |
| `frontend-react/src/pages/` | 业务总览、内容平台、应用市场、小红书、直播、员工和系统页面 |
| `frontend-react/src/components/` | 指标卡、报表脚注、筛选器、图表、错误边界和动效 |
| `frontend-react/src/config/` | 功能开关（features.ts：Web 版 vs 桌面版显隐配置） |
| `frontend-react/src/services/` | HTTP、数据、上传、元数据、版本和 Orval mutator |
| `frontend-react/src/stores/` | Zustand 应用与筛选状态 |
| `frontend-react/src/types/` | 业务类型和 Orval 生成 API 类型 |
| `frontend-react/src/styles/` | 全局 token、变量、mixins 和基础样式 |
| `frontend-react/src/utils/` | 筛选适配、文本清洗、图表辅助函数、环境判断（isDesktop） |

### 页面分区

- 业务总览：全渠道获客、互联网渠道数据概览、转化漏斗、厂商分析。
- 业务专题：内容平台线索与青鸟对账、应用市场、小红书、直播获客、员工转化。
- 系统功能：报告生成、数据导入、账号管理、数据库备份。
- 路由以 `frontend-react/src/router/index.tsx` 和 `frontend-react/src/layouts/MainLayout.tsx` 当前实现为准。

## 共享入口

| 入口 | 用途 |
| --- | --- |
| `MetricCard` / `MetricSection` | 报表头部统一指标卡与响应式卡组 |
| `ReportFooter` | 数据源、端点、口径和备注的统一弱化脚注 |
| `FilterBar` | 报表筛选器统一入口（内置查询/重置按钮 + `DateRangeFilter` 近 7/14/30/90/180 天快速选择） |
| `FunnelChart` | Ant Design Plots 漏斗及 CSS 横条错误降级 |
| `CalendarHeatmap` | Dashboard 开户日历热力图 |
| `sanitizeText` | 清理 Excel 导入字段中的 BOM、NUL、控制字符、替换符和零宽字符 |

## 核心文件清单

以下文件直接影响业务口径、数据导入、全局路由或跨端契约。变更这些文件时必须先阅读 `business-invariants.md`（后端查询）或 `cross-platform.md`（前端路由），并在通用验证基础上按风险扩大检查范围。

### 后端核心文件

| 文件 | 影响范围 | 变更时额外验证 |
| --- | --- | --- |
| `app.py` | Flask 启动、蓝图注册、中间件、主播映射同步 | API smoke + 深链接/静态资源验证 |
| `config.py` | 环境变量、路径、鉴权开关 | 确认 `.env.example` 默认值一致；四端启动不受影响 |
| `backend/models_v2.py` | 业务 ORM 中文列名、表结构 | 确认上游文件列名一致；`to_sql` 落库结果核对 |
| `backend/models.py` | 系统表 | 确认 `db.create_all()` 注册路径 |
| `backend/processors/v2/raw_import.py` | 唯一业务导入处理器 | 使用隔离数据库和最小样例验证目标表、行数、replace/append 语义 |
| `backend/routes/data/leads.py` | 漏斗、线索、转化查询 | 核对 `business-invariants.md` 中的口径规则 |
| `backend/routes/data/cost_analysis.py` | 成本分析查询 | 核对 `business-invariants.md` 中的口径规则 |
| `backend/routes/reports/app_market.py` | 应用市场专题报表 | 核对漏斗不变平、真实获客渠道过滤 |

### 前端核心文件

| 文件 | 影响范围 | 变更时额外验证 |
| --- | --- | --- |
| `frontend-react/src/router/index.tsx` | 全局路由、lazy 加载 | `npm run test:smoke` + 跨端契约检查 |
| `frontend-react/src/layouts/MainLayout.tsx` | 主框架、菜单、功能开关 | typecheck + 四端布局验证 |
| `frontend-react/src/services/mobileRouteHandler.ts` | 移动端/PWA SQL 翻译 | `python scripts/check_api_contract.py` + `check_route_drift.py` |
| `frontend-react/src/config/features.ts` | 功能开关（Web/桌面/移动端显隐） | 确认四端菜单和页面行为一致 |
| `frontend-react/src/services/dataService.ts` | HTTP 请求层、Bearer token 注入 | typecheck + 确认上传/鉴权路径不受影响 |

### 验证升级原则

1. 核心文件变更的最小验证 = 该文件类型的通用验证 + 上表中的额外验证。
2. 同时变更多个核心文件时，按风险最高的文件确定验证范围。
3. 涉及业务口径的核心文件（`leads.py`、`cost_analysis.py`、`app_market.py`、`models_v2.py`）必须先读 `business-invariants.md`。
4. 涉及跨端契约的核心文件（`mobileRouteHandler.ts`、`router/index.tsx`）必须先读 `cross-platform.md`。

## 外部集成

- 官网（GitHub Pages）：`website/` 静态页面，通过 `.github/workflows/pages.yml` 自动部署到 GitHub Pages 根路径，含三端下载入口（`website/app.js` 调 GitHub API 直接触发最新 release 资产下载）与产品介绍；PWA 部署在 `/app/` 子路径。
- 飞书同步路由已下线；环境变量只作为预留，不能根据旧文档假设存在可用路由。
- 坚果云 WebDAV 由 `backend/routes/webdav_backup.py` 和 `backend/utils/webdav_client.py` 处理。
- WebDAV 网络层错误返回 `502 + UPSTREAM_UNAVAILABLE`；其他列表/业务错误返回 `500 + LIST_FAILED`。
- 主播类型配置由 JSON 同步到数据库，详见 `business-invariants.md`。

## 环境与运行

- 克隆或首次进入仓库时按根规则执行一键 setup；脚本负责 `.venv`、Python/npm 依赖、前端构建和 `.env` 初始化。
- 开发模式可使用 `scripts/start-dev.bat` / `scripts/stop-dev.bat`，PID 位于 `logs/dev-pids/`，日志位于 `logs/`。
- 前端生产代码修改后必须重新构建 `frontend-react/dist/`；Flask 直接读取新产物。
- 完整命令和部署排障参见 `README.md` 与 `docs/rules/toolchain.md`。历史 v1 部署指南（Gunicorn + Nginx + Docker 方案）已归档至 `docs/_archive/部署指南.md`，与当前 SQLite 单文件部署脱节，仅供追溯。

