# 省心投 BI 项目文档（AGENTS / CLAUDE）

> 本文件是仓库根目录的项目工作说明。`AGENTS.md` 与 `CLAUDE.md` 应保持同一内容；修改其中一份时必须同步另一份。
> 本地工作目录：`D:/AIproject/省心投BI`，默认环境：Windows + PowerShell。

## 1. 项目概况

省心投 BI 是互联网广告投放与开户转化数据分析平台，面向券商财富管理场景，核心能力是把上游 ETL 已处理好的投放、转化、开户与内容数据原样入库，并在前端做多维查询和可视化报表。

- 后端：Python Flask + SQLAlchemy + SQLite + pandas 原样导入。
- 前端：React 19 + TypeScript + Vite + Ant Design 5 + ECharts + Zustand。
- 当前版本基线：`version.json` 为 `3.1.1`，发布日期 `2026-07-10`。
- 当前代码状态：v2 库表重构、v3.1 报表重梳与 v3.1.1 前端 UI 统一化（指标卡 / token / 日夜主题）均已落地。
- 历史命名：仓库目录是 `省心投BI`，但数据库、包名和部分历史文档仍使用 `shengxintou`，不要为了“统一命名”随意改路径或表名。

## 2. 产品与数据方向

**战略方向：只做数据存储 + 查询聚合 + 可视化呈现，不在本项目继续做业务 mapping / 清洗 / 归一化 / 字段补全。**

落地含义：

- 上游 ETL 负责业务清洗、规范化、字段补全、漏斗预计算与口径修正。
- 后端导入只做文件读取、空值处理、日期/布尔/ID 等格式层面的安全处理，以及 `pandas.to_sql(if_exists='replace')` 原样落库。
- 查询端点可以做 SELECT、SUM、GROUP BY、分页和兼容性派生字段，但不要新增下游业务口径修补逻辑。
- 新数据类型必须走 v2 原样导入入口：`backend/processors/v2/raw_import.py`。
- 旧 v1 上传类型已退役并返回 410 Gone，不要复活旧 processor 或旧表链路。

## 3. 当前阶段

### 已完成

- v2 库表重构：9 张 DIM/DWD/DWS 新表，13 个历史查询端点改查新表，前端字段适配完成。
- v1 清理：旧 ORM、旧处理器、旧 SQLite 表与旧原生前端已清理到历史状态。
- v3.1 报表重梳：菜单重构、全渠道获客、应用市场四子页、双漏斗、员工转化双源、直播占位、数据新鲜度均已落地。
- 数据导入：仅识别 6 个 v2 数据类型，旧 7 个类型返回 410。
- v3.1.1 前端 UI 统一化：
  - 抽出公共 `MetricCard` / `MetricSection` 组件（`frontend-react/src/components/MetricCard/`），所有报表头部数据卡片统一调用。
  - 引入 design token 体系 `frontend-react/src/styles/tokens.css`（品牌色 / 间距 / 圆角 / 阴影 / 字体 / 功能色 / 图表色板，日夜间变量）与共享 mixin `frontend-react/src/styles/mixins.scss`（`card-section-header` / `filter-bar` / `text-ellipsis` / `card-base` / `table-section-title`）。
  - 接入日/夜主题：`<html data-theme="dark">` + `useAppStore.themeMode` + Ant Design `ConfigProvider` `darkAlgorithm`，Header 提供切换入口。
  - 删除 `MainLayout` 中 7 处 `!important` 与 14 处 `:global()` 覆盖，统一 Menu 选中色为品牌色 `#1890ff`。
  - 报表头部数据卡片统一为 `MetricSection + MetricCard` 4/3/2/1 响应式，与互联网渠道数据概览一致（小红书运营报表不动）。
- v3.1.1 报表样式收敛（2026-07-10）：
  - 抽出共享 `FunnelChart` 组件（`frontend-react/src/components/Chart/FunnelChart.tsx`，基于 `@ant-design/charts` 的 `Funnel`），用于内容平台漏斗 / 应用市场漏斗 / 主播引流漏斗三个场景；原 ECharts funnel 的对数缩放逻辑下架。已接入：`ConversionFunnel` / `AppMarket/Funnel` / `Live/Funnel`。
  - 抽出共享 `ReportFooter` 组件（`frontend-react/src/components/ReportFooter/`），作为报表页底部弱化区：用于收纳「数据源 / 端点 / 口径说明」说明性文字，避免散落在筛选卡 / Tab 内容 / 卡片描述里。已迁移页：`OmniChannel` / `AppMarket/Funnel` / `Live/Funnel` / `AnchorCluster` / `ConversionFunnel`。
  - `全渠道获客概览` 顶部第 4 张卡（TOP 渠道类别 + 占比）的 title 改为 `${channel_category} · 占比 ${share}%`，与其他 3 张卡结构对齐。
  - `Live/Funnel.tsx` 228 处 `\uXXXX` 转义中文字符残留全部修复，并修复「全冶稿」错别字。
  - 报表卡片外的 inline「数据源」/「总 xx」备注一律从筛选卡 / Tab 内容里调出，统一接到 `ReportFooter` 底部弱化区。


### 进行中

- 海报设计子系统（`PosterModal` / `WeeklyReportPreview` / `PosterExportButtons`）保留自包含样式，不纳入全局 token 改造。
- 数据图表 JS option 配色暂未迁移到 token 色板常量；按需在 `EChartsComponent` 选项中按业务自定义。

## 4. 开发命令

### 后端（项目根目录）

```powershell
pip install -r requirements.txt

# 开发模式：标准 Flask 服务，默认 5000 端口
$env:DEV_MODE='1'; python app.py

# 桌面模式：检测到 pywebview 时打开嵌入式窗口，打包版使用
python app.py

# 数据库建表（删除数据库后可用；会按当前 ORM 建表）
python -c "from backend.database import db; from app import app; app.app_context().push(); db.create_all()"
```

### 前端（`frontend-react/`）

```powershell
cd frontend-react
npm install
npm run dev          # Vite dev server :3000，代理 /api -> 127.0.0.1:5000
npm run build        # tsc 类型检查 + vite build，产物到 dist/
npm run typecheck    # TypeScript 检查
npm run lint         # ESLint flat config
npm run preview      # 预览构建产物

# API 类型生成（orval 会覆盖生成文件，不要手改生成物）
npm run generate:api

# Playwright E2E
npm run test
npm run test:headed
npm run test:report
```

### 前后端联动

- 开发期通常同时运行后端 `:5000` 与前端 `:3000`。
- 生产/桌面模式下，Flask 直接托管 `frontend-react/dist/`；前端重新构建后刷新页面即可，不一定要重启 Flask。
- React Router 依赖 `dist/index.html` 做 SPA 兜底；如果只有后端没有前端构建产物，非 API 路由会不可用。
- 后端代码有未提交改动时 Flask 不会自动 reload，需要手动重启 `python app.py`；前端 `:3000` 由 Vite HMR 自动刷新，不依赖 Flask。

## 5. 后端架构

```text
backend/
├── database.py                 # SQLAlchemy 单例 db，避免循环导入
├── models.py                   # 系统表：DataImportLog / SystemConfiguration / WeeklyReport
├── models_v2.py                # v2 新表 ORM，列名 1:1 对齐源表，含中文字段
├── processors/v2/raw_import.py # v2 原样导入入口
├── routes/upload.py            # 上传、任务进度、导入历史、数据类型列表
├── routes/metadata.py          # 元数据与数据新鲜度
├── routes/data/                # 历史业务查询蓝图，路径兼容旧前端
├── routes/reports/             # v3.1 新报表蓝图：omni_channel / app_market
├── routes/webdav_backup.py     # 坚果云 WebDAV 备份与恢复
├── routes/version.py           # 本地版本信息
└── routes/weekly_reports.py    # 周报生成与保存
```

`app.py` 负责：

- 创建 Flask 应用并初始化 SQLAlchemy。
- 注册 `API_PREFIX = /api/v1` 下的数据蓝图，以及硬编码前缀的 `webdav`、`version`、`weekly_reports`、`reports/*` 蓝图。
- 通过 `DoubleApiRewriteMiddleware` 把旧缓存导致的 `/api/api/...` 重写为 `/api/...`。
- 托管 `frontend-react/dist/`，并为 `/assets/`、`/icons/`、`/js/`、`/libs/` 提供静态路由。
- 非 API 路径交给 React Router SPA 兜底。
- 可选初始化 Swagger；`flasgger` 未安装时应优雅跳过。

## 6. v2 数据模型与导入

### 9 张新表

- 维度层：`dim_account`、`dim_vendor`、`dim_channel_category`、`dim_channel`。
- 明细层：`fact_conv_content`、`fact_conv_appmarket`。
- 聚合层：`agg_vendor_daily`、`agg_xhs_note`、`agg_daily_channel_open`。

### 6 个有效上传类型

| data_type | 业务含义 | 目标表 |
| --- | --- | --- |
| `account_mapping` | 投放账号映射 | `dim_account` + `dim_vendor` |
| `conversion_content` | 内容平台加微链路 | `fact_conv_content` |
| `conversion_appmarket` | 应用市场下载链路 | `fact_conv_appmarket` |
| `vendor_daily` | 厂商广告投放分析 | `agg_vendor_daily` |
| `xhs_note` | 小红书笔记 | `agg_xhs_note` |
| `channel_open` | 开户渠道分析 | `agg_daily_channel_open` |

### 退役上传类型

以下类型保留识别但返回 410：`tencent_ads`、`douyin_ads`、`xiaohongshu_ads`、`backend_conversion`、`xhs_notes_list`、`xhs_notes_daily`、`xhs_notes_content_daily`。

### 导入流程

`POST /api/v1/upload` → 创建 `DataImportLog` → 后台线程调用 `raw_import.write_to_db()` → `pandas.read_excel/read_csv` → 格式层处理 → `to_sql(replace)` → 更新导入日志 → 成功后删除上传临时文件。

## 7. 查询与报表口径

通用原则：端点路径尽量保持兼容，但内部必须查询 v2 新表；不要混查已退役 v1 表。

- `POST /api/v1/dashboard/core-metrics` 与 `/dashboard/trend-data`：主源 `agg_vendor_daily`，返回 SUM 聚合与兼容性派生字段。
- `POST /api/v1/summary`、`/query`、`/trend`：历史兼容端点，仍按 v2 新表输出旧前端可消费结构。
- `POST /api/v1/conversion-funnel/split`：双漏斗端点，内容平台查 `fact_conv_content`，应用市场查 `fact_conv_appmarket`。
- `POST /api/v1/conversion-funnel`：兼容旧端点，仍保留但后续应优先使用 `/conversion-funnel/split`。
- `POST /api/v1/reports/omni-channel/*`：全渠道获客，**单一数据源 `agg_daily_channel_open`**；不要混入 `fact_conv_*` 或 `agg_vendor_daily`。
- `POST /api/v1/reports/app-market/*`：应用市场专项，数据源 `fact_conv_appmarket`；四类端点为 `summary`、`funnel`、`detail`、`creative`，筛选项为 `filter-options`。
- `POST /api/v1/employee-conversion/analysis`：员工转化分析；明细口径来自 `fact_conv_content`，顶部/概览指标注意现有兼容逻辑。
- `POST /api/v1/employee-conversion/analysis-channel-overview`：渠道概览来自 `agg_daily_channel_open`，与 detail 是独立口径，数字不一致是预期。
- `GET /api/v1/leads-detail`：线索明细来自 `fact_conv_content`。
- `POST /api/v1/leads-detail/anchor-clusters`：按 `客户来源` 中“平台引流-主播名”模式聚类，供主播聚类页面使用。
- `POST /api/v1/xhs-notes-list` 与 `/xhs-notes-operation-analysis`：小红书笔记与运营分析来自 `agg_xhs_note`。
- `GET /api/v1/data-freshness`：返回 5 张核心表新鲜度：`vendor_daily`、`xhs_note`、`fact_conv_content`、`fact_conv_appmarket`、`agg_daily_channel_open`；状态阈值为 normal ≤5 天、warning ≤14 天、critical >14 天。

## 8. 前端架构

```text
frontend-react/src/
├── pages/          # 顶级页面与报表页面
├── components/     # Chart / DataFreshness / Filter / GuideModal / HelpModal / Icon / MetricCard
├── services/       # http、dataService、metadataService、uploadService、orvalMutator
├── stores/         # Zustand：useAppStore（含 themeMode）、useFilterStore
├── router/         # createBrowserRouter 路由配置与旧路径 redirect
├── layouts/        # MainLayout 菜单与整体框架
├── styles/         # tokens.css / variables.scss / mixins.scss / global.scss
└── types/          # API 与业务类型；生成文件不要手改
```

### 公共组件：MetricCard / MetricSection

- 路径：`frontend-react/src/components/MetricCard/{index.tsx, MetricCard.module.scss}`。
- 职责：所有报表头部数据卡片统一调用，禁止在 page 内重写 `Card + Row/Col` 重复实现。
- `MetricCard`：单卡片，支持 `title` / `value` / `wowChange` / `prefix` / `suffix` / `formatter` / `inverseTrend` / `variant` / `icon` / `tooltip` / `description`。
- `MetricSection`：分组容器，支持 `title` / `description` / `minCardWidth`（默认走 token）；内含 `sectionHeader`（标题 + 描述）与 `metricGrid`（flex 自适应）。
- `metricGrid` 响应式：默认 4 列基线（与互联网渠道数据概览 `Row/Col lg={6}` 对齐），1200px 以下 3 列，768px 以下 2 列，576px 以下 1 列。

### 已统一数据卡片样式的报表

| 报表 | 路径 | 头部卡片 |
| --- | --- | --- |
| 互联网渠道数据概览 | `pages/Dashboard/` | 前端投放 / 后端转化 / 运营效率 三组 |
| 全渠道获客 | `pages/Reports/OmniChannel/` | 总开户 / 总入金 / 总有效户 / TOP 渠道 |
| 转化漏斗 | `pages/ConversionFunnel/` | 内容平台 + 应用市场漏斗指标 |
| 厂商分析 | `pages/AgencyAnalysis/` | 花费 / 曝光 / 点击 / 线索 / 开户 / 有效户 |
| 应用市场 / 获客漏斗 | `pages/Reports/AppMarket/Funnel.tsx` | 漏斗阶段汇总 |
| 应用市场 / 创意效果 | `pages/Reports/AppMarket/Creative.tsx` | 创意汇总 |
| 直播获客 / 业务漏斗 | `pages/Live/Funnel.tsx` | 主播引流漏斗指标 |
| 主播聚类 | `pages/AnchorCluster/` | 主播线索 / 开口 / 有效 / 开户指标 |

> 小红书运营报表（`pages/XhsNotes/Operation.tsx`）与海报子系统保持原有样式，不纳入统一。

### 当前路由与菜单

- `/omni-channel`：全渠道获客，默认首页。
- `/dashboard`：互联网渠道数据概览。
- `/conversion-funnel`：内容平台 + 应用市场双漏斗。
- `/leads-detail`：线索明细。
- `/anchor-clusters`：主播聚类。
- `/agency-analysis`：厂商分析。
- `/xhs-notes/list`、`/xhs-notes/operation`：小红书笔记与运营分析。
- `/app-market/funnel`、`/app-market/comparison`、`/app-market/detail`、`/app-market/creative`：应用市场四子页。
- `/employee-conversion/analysis`、`/employee-conversion/weekly`：员工转化分析与周报。
- `/live/funnel`：直播获客占位页，后续 v3.2 接入。
- `/report-generation`：报告生成。
- `/system/data-import`、`/system/account-management`、`/system/abbreviation-management`、`/system/database-backup`：系统配置。
- 旧路径 `/reports/app-market` 与 `/reports/omni-channel` 已 redirect 到新路径。

### 主题与样式 token

- `styles/tokens.css`：CSS 自定义属性单一事实来源（颜色 / 间距 / 圆角 / 阴影 / 字号 / 字重 / 图表色板），日间在 `:root`、夜间在 `[data-theme="dark"]`。
- `styles/mixins.scss`：共享 SCSS mixin（`card-section-header` / `card-section-title` / `card-section-desc` / `filter-bar` / `filter-group` / `filter-label` / `text-ellipsis` / `card-base` / `table-section-title`），通过 `@use '../../styles/mixins' as *;` 引入。
- `App.tsx` 的 `ConfigProvider`：日间用显式 token + `defaultAlgorithm`，夜间切换到 `darkAlgorithm`，并把 `colorPrimary` 等关键 token 同步到 `tokens.css` 的值，避免双份维护漂移。
- `useAppStore.themeMode`：`'light' | 'dark'`，持久化到 `localStorage`；切换时改写 `<html data-theme="...">` 让 `tokens.css` 的夜间变量生效。

### 前端注意事项

- `frontend-react/src/types/api.ts` 为 orval 生成文件，不要手改；需要更新时运行 `npm run generate:api`。
- 新增样式优先使用 `styles/tokens.css` 的 CSS 变量和 `styles/mixins.scss` 的 mixin；不要继续硬编码 `#1890ff` / `#333` / `#666` / `#f0f0f0` 等。
- 暗色主题由 `useAppStore.themeMode` + `<html data-theme="dark">` + Ant Design `ConfigProvider` 联动；不要只改 SCSS 而忽略组件 token。
- `PosterModal`、周报海报预览与导出按钮是相对独立的海报设计子系统，除非任务明确要求，不要强行纳入全局 UI token 改造。

## 9. 数据库、配置与集成

- 默认 SQLite：`database/shengxintou.db`，可通过 `DATABASE_PATH` 覆盖。
- 启动时会自动创建数据库、上传、日志目录，并执行 `db.create_all()`。
- SQLite 优化在 `app.py` 中配置：cache、synchronous、temp_store、busy_timeout 等；当前倾向传统 `journal_mode=DELETE`，不要轻易切 WAL。
- 环境变量读取 `.env`；示例在 `.env.example`。
- WebDAV 备份使用 `webdavclient3`，配置项为 `WEBDAV_*`，默认保留最近 3 个备份。
- 飞书配置仍存在于 `config.py` 与相关同步脚本中，但部分表 ID 映射带历史表名；改飞书同步前必须重新核实当前 v2 表结构。
- 打包形态包含 `省心投启动器.exe`、便携 Python / `lib/` 目录与 PyInstaller spec；不要把打包产物当源码重构对象。

## 10. 文档索引

- `README.md`：用户视角介绍，部分版本描述可能滞后于 `version.json`。
- `docs/v3.1_报表重梳方案.md`：v3.1 菜单、双漏斗、双源、应用市场、直播占位设计。
- `docs/库表重构设计_v2.md`：v2 DIM/DWD/DWS 设计基线。
- `docs/库表重构设计_v3.md`：v3 实施与收尾对账。
- `docs/前端UI优化规划PRD.md`：v3.1.1 设计 token / 日夜模式 / 样式治理规划与验收标准。
- `docs/前端全栈改造清单.md`：React 迁移要点。
- `docs/数据库架构文档.md`：旧 13 表说明，查新表时优先看 v2/v3 重构文档。
- `docs/部署指南.md`：开发、生产、Docker、性能优化、监控与故障排查。
- `docs/uploads_cleanup_guide.md`：上传目录清理指引。
- `docs/*_legacy.md`：历史归档，仅作参考。

## 11. 修改守则

- 修改 `AGENTS.md` 或 `CLAUDE.md` 时，必须保持两者内容一致。
- 修改业务查询前，先确认端点当前使用的源表和口径，不要照搬 README 或旧文档中的过期描述。
- 不要改 `models_v2.py` 的中文列名来迎合前端字段；这些列名要与源表/to_sql 结果对齐。
- 不要新增 mapping/归一化 processor；确需处理新数据源时，优先补充上游 ETL 或 v2 原样导入映射。
- 不要复活旧上传类型、旧 v1 表、旧原生前端目录或历史迁移脚本。
- 不要手改生成文件；尤其是 orval 生成的 API 类型。
- 报表头部数据卡片一律使用 `MetricCard` + `MetricSection`；禁止在 page 内重新实现 `Card + Row/Col` 卡片组（小红书运营报表除外）。
- 提交前必须确认：未把本地数据库、上传文件、备份文件、`prototype/`、`tmp_*`、`logs/bug-fix-shots/` 加入索引；`.env` 与 `database/*.db` 已被 `.gitignore` 排除。
- 文档只描述当前真实状态；如果代码、`version.json`、README 冲突，以代码和 `version.json` 为准，并在文档中标注滞后点。

## 12. 验证建议

- 文档改动：至少检查 `git diff -- AGENTS.md CLAUDE.md`，并确认两份文件一致（`fc /b` 比对文件哈希）。
- 后端改动：优先跑相关端点的最小 smoke，再视情况启动 `$env:DEV_MODE='1'; python app.py`；如果修改了 `backend/routes/*` 而 Flask 进程仍在跑，需要手动重启。
- 前端逻辑/类型改动：优先跑 `npm run typecheck`，再跑 `npm run lint` 与必要页面 smoke。
- 前端样式改动：结合浏览器检查日/夜主题、报表头部卡片、表格和筛选栏；不要只看构建结果。
- 全量验证成本较高时，在最终说明里明确已跑和未跑的命令。
