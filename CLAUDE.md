# 省心投 BI 项目文档（AGENTS / CLAUDE）

> 本文件是仓库根目录的项目工作说明。`AGENTS.md` 与 `CLAUDE.md` 应保持同一内容；修改其中一份时必须同步另一份。
> 本地工作目录：`D:/AIproject/省心投BI`，默认环境：Windows + PowerShell。

## 1. 项目概况

省心投 BI 是券商财富管理场景下的互联网广告投放 + 开户转化数据分析平台，定位是「数据存储 + 查询聚合 + 可视化呈现」。原始数据的 mapping / 清洗 / 归一化 / 漏斗预计算由上游 ETL 完成，下游只做原样入库 + SELECT 聚合 + 报表展示。

- 后端：Python Flask + SQLAlchemy + SQLite + pandas 原样导入（`to_sql(replace)`）。
- 前端：React 19 + TypeScript + Vite + Ant Design 5/6 + @ant-design/plots / @ant-design/charts + ECharts + Zustand。
- 当前版本基线：`version.json` 为 `3.1.11`（2026-07-15）。下一站 `v3.1.12`（待规划：webdav 5xx 长尾专项排查 + 趋势图 / 4 卡 / 筛选解耦 后续收口）。

### v3.1.11 已落地（2026-07-15）

### v3.1.12 已落地（2026-07-15）

- **代理商简称映射全链路（简称优先）**：新增 ackend/utils/agency_mapper.py 提供 get_all_shorts() / short_to_full() / ull_to_short() / enrich_items() / expand_short_to_fulls()；metadata 端点 agencies 改从 DimVendor.agency_short（简称）查询，返回 {value, label, full_names} object format；gency_full_map 透传前端用于标签提示。
- **所有后端 .厂商/广告代理商 in_ 筛选展开简称→全称**：gency_analysis.py / cost_analysis.py / dashboard.py / external_analysis.py / leads.py / 	rend.py 共 6 个文件 .in_() 前调用 expand_short_to_fulls()，支持前端选简称匹配后端全称记录。
- **简称 CRUD 调用 reset_cache**：bbreviation_mapping.py 在 create/update/delete 操作后调用 gency_mapper.reset_cache()，确保系统配置页修改 DimVendor 后缓存即时刷新。
- **AgencyFilter 前端适配新格式**：metadata agencies 从 string[] → {value, label, full_names}[] 后，AgencyFilter.tsx 的 map() 和 metadataService.ts 接口类型同步更新。
- **AgencyAnalysis 前端显示改 agency_short**：表格列 dataIndex 从 gency 改为 gency_short；CSV 导出兜底 gency_short || agency；rowKey 改用 gency_short||agency。
- **OmniChannel 4 卡标题恢复短标题**：总开户成功人数→开户成功 / 总入金户数→入金户数 / 总有效户数→有效户数 / 互联网渠道开户数→互联网开户；删除未使用的 Typography import。
- **build**：
pm run build 0 error（~5988 modules）→ dist 已刷新 → 5000 端口同步。
- **v3.1.10 变更说明**（2026-07-15 已落地）：
  - **ECharts 调色板统一**：新增 `frontend-react/src/utils/echartsColors.ts`（`ECHARTS_COLORS` 8 色 hex + `pickEChartsColor(idx)`），与 `tokens.css` `--chart-color-1` ~ `--chart-color-8` 字节对齐。**根因**：ECharts canvas/SVG 渲染不解析 CSS `var()`，原先传 `var(--chart-color-N)` 字符串会被静默 fallback 到默认色（灰色），导致 OmniChannel 4 类渠道日趋势、AgencyAnalysis 日级趋势、Dashboard TrendChart 多 series 全是同色或灰色。修复后全报表 ECharts 多 series 按索引自动取 8 色。
  - **TrendChart 边框对齐 + 间距**：`<Card variant="borderless">` → `<Card size="small">`；`.trendCard` 加 `margin-bottom: var(--spacer-16)`，与下方开户口历热力图间距 16px（之前无边距贴在一起）。
  - **开户口历热力图年度总开户起算点改为 2026-01-01**：`CalendarHeatmap` 新增 `YEAR_START = '2026-01-01'`，`stats.sum` 仅累加 `date >= 2026-01-01` 的值（年度总开户）；`stats.max / activeDays` 仍取 365 天全量用于 level 颜色分类。
  - **全局日期筛选器默认值统一为 2026-01-01 ~ 2026-12-31**：覆盖 7 个页面 `useState`（AnchorCluster / Live/Funnel / AppMarket×4 / OmniChannel）+ EmployeeConversion/Weekly 2 处 + ConversionFunnel（useState + resetFilters）+ XhsNotes/List + LeadsDetail（useState + filtersRef）+ EmployeeConversion/Analysis + XhsNotes/Operation 3 个函数 + `useFilterStore.getDefaultDateRange` + `useDashboardFilters.getDefaultDateRange`。全文已无残留 `2026-06-30` / `2020-01-01` 旧默认值。
- 历史命名：仓库目录是「省心投 BI」，但数据库文件 `database/shengxintou.db`、模块名 `shengxintou-platform` 仍沿用旧名，禁止为了"统一命名"随意改路径或表名。

## 2. 产品与数据方向

**只做数据存储 + 查询聚合 + 可视化呈现，不在本项目继续做业务 mapping / 清洗 / 归一化 / 字段补全。**

- 上游 ETL 负责业务清洗、规范化、字段补全、漏斗预计算与口径修正。
- 后端导入只做文件读取、空值处理、日期/布尔/ID 的格式层安全处理，外加 `pandas.to_sql(if_exists='replace')` 原样落库。
- 查询端点可以做 SELECT、SUM、GROUP BY、分页和兼容派生字段，不要新增下游业务口径修补逻辑。
- 新数据类型必须走 v2 原样导入入口：`backend/processors/v2/raw_import.py`。
- 旧 v1 上传类型已退役并返回 410 Gone，不要复活旧 processor 或旧表链路。

## 3. 共享组件

| 组件 | 路径 | 职责 |
|---|---|---|
| `MetricCard` / `MetricSection` | `frontend-react/src/components/MetricCard/` | 单张指标卡 + 卡组容器（响应式 4/3/2/1） |
| `ReportFooter` | `frontend-react/src/components/ReportFooter/` | 报表页底部弱化区，集中展示数据源 / 端点 / 口径说明 |
| `FunnelChart` | `frontend-react/src/components/Chart/FunnelChart.tsx` | `@ant-design/plots` Funnel + ErrorBoundary CSS 横条降级 |
| `CalendarHeatmap` | `frontend-react/src/pages/Dashboard/components/` | 蓝色 5 档 `l0..l4` 开户日历热力图 |
| `sanitizeText` | `frontend-react/src/utils/sanitizeText.ts` | 客户端文本清洗：剥 BOM / NUL / 控制字符 / `�` / 零宽 |

## 4. 关键架构

### 4.1 后端分层（M / Q / V — 见 docs/库表重构设计_v3.md）

```
backend/
├── models.py / models_v2.py   # 系统表 + 9 张新表 ORM（列名 1:1 含中文）
├── database.py                # 单例 SQLAlchemy(db)
├── __init__.py                # 启动时 import models_v2 注册到 metadata
├── processors/v2/raw_import.py # v2 原样导入
├── routes/
│   ├── upload.py              # v2 上传入口，旧类型返回 410 Gone
│   ├── metadata.py            # 元数据 + 数据新鲜度
│   ├── webdav_backup.py       # 坚果云 WebDAV
│   ├── reports/               # v3.1 新增 omni_channel / app_market 蓝图
│   ├── data/                  # 14 个查询蓝图（全部查新表）
│   └── version.py / weekly_reports.py / feishu_sync.py
└── utils/decorators.py        # @handle_exceptions 等
```

**v2 重构**：6 个新数据类型 → `dim_account / dim_vendor / fact_conv_content / fact_conv_appmarket / agg_vendor_daily / agg_xhs_note / agg_daily_channel_open`；13 个查询端点路径零变动，内部从旧表改查新表。

**v3.1 报表重梳**：顶级菜单重构（全渠道获客 / 互联网渠道数据概览 / 转化漏斗 / 线索明细 / 厂商分析 / 小红书 / 应用市场 / 员工转化 / 直播获客 / 报告生成 / 系统配置）+ 双漏斗（content + appmarket）+ 员工转化双源 + 应用市场 4 子页 + 数据新鲜度。

### 4.2 路由前缀

`API_PREFIX = /api/v1`；新增 `reports/` 蓝图：`/api/v1/reports/omni-channel/*` + `/api/v1/reports/app-market/*`。

### 4.3 WSGI 中间件

`app.py` 中 `DoubleApiRewriteMiddleware` 把 `/api/api/...` 重写为 `/api/...`，兼容旧版 JS 缓存的重复前缀 bug。

### 4.4 React Router SPA 兜底

`@app.before_request serve_react_app` 在路由匹配失败时返回 `index.html`；Flask 还显式提供 `/js/`、`/libs/`、`/assets/`、`/icons/` 静态目录。

### 4.5 前端结构（frontend-react/src/）

```
components/    # Chart / DataFreshness / Filter / GuideModal / Icon / MetricCard / MetricReportFooter
stores/        # zustand: useAppStore, useFilterStore
services/      # http / dataService / metadataService / uploadService / orvalMutator
types/         # api.ts（orval 生成）/ api.schemas.ts / index.ts
utils/         # filterAdapter / agencyAnalysisChart / legacyLoader / sanitizeText
router/        # createBrowserRouter 配置（含旧路径 redirect）
layouts/MainLayout.tsx
styles/        # tokens.css + mixins.scss + variables.scss + global.scss
pages/         # Dashboard / OmniChannel / ConversionFunnel / LeadsDetail / AgencyAnalysis
               # XhsNotes/{List,Operation} / EmployeeConversion/{Analysis,Weekly}
               # Reports/AppMarket/{Funnel,Comparison,Detail,Creative} / Reports/OmniChannel
               # Live/{Funnel,AnchorCluster} / ReportGeneration
               # System/{DataImport,AccountManagement,AbbreviationManagement,DatabaseBackup}
```

### 4.6 数据库

- 默认 SQLite：`database/shengxintou.db`（可由 `DATABASE_PATH` env 覆盖）。
- 启动时 `app.configure_sqlite_optimization()` 设置 PRAGMA（cache_size 100MB、synchronous=NORMAL、temp_store=MEMORY、busy_timeout=5s）；使用传统 `journal_mode=DELETE`（非 WAL），避免便携版数据库损坏。
- `config.py` 同时定义 `FEISHU_TABLE_IDS`（数据库表 → 飞书 bitable ID 映射）和 `WEBDAV_*`（坚果云备份）配置。

### 4.7 飞书 / WebDAV 集成

- `feishu_sync.py` 通过 `FEISHU_TABLE_IDS` 做双向同步；启用开关 `FEISHU_ENABLED`。
- `webdav_backup.py` 用 `webdavclient3` 推送到坚果云；网络层错误（SSL / 连接被重置 / 拒绝）→ **502 + UPSTREAM_UNAVAILABLE**，其它 → 500 + LIST_FAILED。

## 5. 数据导入流程（v2）

上传文件 → `POST /api/v1/upload` → `backend.routes.upload` 异步线程：

1. 创建 `DataImportLog` 记录（status / progress / inserted_rows / ...）。
2. 调用 `backend.processors.v2.raw_import.write_to_db(data_type, filepath)`。
3. v2 原样导入：`pandas.read_excel` → 规范化（`nan`→NULL、时间解析、超长 ID 转字符串、`是/否`→0/1）→ `pandas.to_sql(if_exists='replace')`。
4. 更新 `DataImportLog` 完成。

> **关键**：v2 不算漏斗、不算转化率、不补映射 — 这一切都在 ETL 上游完成。下游查询只做 SELECT + 聚合。

## 6. 开发命令

### 6.1 后端（项目根目录）

```powershell
pip install -r requirements.txt

# 开发模式（5000 端口 Flask）
$env:DEV_MODE='1'; python app.py

# 重置数据库：删 database/shengxintou.db 后重启会自动 db.create_all()
```

### 6.2 前端（frontend-react/）

```powershell
cd frontend-react
npm install
npm run dev          # Vite dev server :3000，自动代理 /api -> 127.0.0.1:5000
npm run build        # tsc 类型检查 + vite build，产物到 dist/
npm run lint
npm run preview
npm run generate:api # orval -> src/types/api.ts
```

### 6.3 端到端测试（Playwright）

```powershell
cd frontend-react
npm run test
npm run test:headed
npm run test:report
```

### 6.4 构建产物路径

Flask 把 `frontend-react/dist/` 当模板 + 静态目录托管。dev 时前端用 vite dev :3000 走代理；生产时直接访问 Flask :5000 读 dist。
开发期改前端代码不需要重启 Flask（vite HMR 自动刷新）；改后端需要重启 Flask。
**生产前端看不到最新代码时** = dist 没构建，跑一次 `npm run build` 即可（5000 端口不需要重启 Flask，dist 文件被即时读取）。

## 7. 配置

复制 `.env.example` 为 `.env`（已 gitignored）。重要变量：
- `DATABASE_PATH`、`HOST`、`PORT`(5000)、`DEBUG`、`DEV_MODE`
- `FEISHU_APP_ID/SECRET/BITABLE_ID`、`FEISHU_ENABLED`
- `WEBDAV_URL/USERNAME/PASSWORD/BASE_PATH/MAX_BACKUPS/USE_COMPRESSION`、`WEBDAV_VERIFY_SSL`、`WEBDAV_PROXY`
- `MAX_CONTENT_LENGTH`(MB)、`ALLOWED_EXTENSIONS`、`UPLOAD_FOLDER`、`LOG_FOLDER`、`LOG_LEVEL`

数据库/上传/日志目录若不存在会在启动时自动创建。

## 8. 注意事项 / 踩坑记录

- **不要动 `data.py.backup_20260211_174355`**：v0.9.1 拆分前的 4000 行单文件备份，仅留作对照。
- **`models_v2.py` 列名含中文**（如 `AggVendorDaily.花费`、`FactConvContent.微信昵称`），SQLAlchemy 用 `Text`/`BigInteger`/`Float`，**禁止改列名以匹配业务字段**。
- **报表头部数据卡片一律 `MetricCard + MetricSection`**；禁止在 page 内重新实现 `Card + Row/Col` 卡片组（小红书运营报表 XhsNotes/Operation 与 EmployeeConversion Weekly 周报海报子系统除外）。
- **数据源 / 端点 / 口径说明一律放进 `ReportFooter`**，不要在 MetricCard description 或筛选卡里重复。
- **乱码防御**：渲染 Excel 导入的脏字符字段（主播名 / 来源 / 备注等）前都要走 `sanitizeText()`，防止上游 GBK / 控制字符渲染成方块。
- **`POST /api/v1/conversion-funnel` 拆两套漏斗**：内容平台走 `fact_conv_content`，应用市场走 `fact_conv_appmarket`，响应带 `channel_category` 字段。
- **`POST /api/v1/employee-conversion/analysis`** 顶部核心指标不过滤，从 `agg_daily_channel_open` + `agg_vendor_daily` 平台概览计算。
- **`POST /api/v1/employee-conversion/analysis-channel-overview`**：员工渠道概览，数据源 `agg_daily_channel_open`，**与 detail 端点是独立口径**。
- **`POST /api/v1/reports/omni-channel/*`**：单一独立数据源 `agg_daily_channel_open`，**禁止混合** fact_conv_* / agg_vendor_daily。第 4 卡用 `internetRow.opens`（按 `channel_category=互联网引流` 拆），KPI 完成率按 `dayOfYear/366` 时间折算。
- **代理商字段三态**：`DimVendor` 含 `agency_name`（全称，如“黑龙江广视科技有限公司”）、`agency_short`（简称/显示名，如“广视科技”）、`agency_letter`（拼音简称，如“gs”）。`agg_vendor_daily.厂商` 和 `fact_conv_content.广告代理商` 存的是**全称**。同一代理商在不同平台的全称可能有差异（如“量子” vs “量子科技”），但**简称是共同的**。前端代理商筛选目前用 `DimVendor.agency_name` + `AggVendorDaily.厂商` 全称做 value，有改进空间。`AbbreviationManagement`（DimVendor CRUD）是维护简称->全称映射的唯一入口。
- **`POST /api/v1/reports/app-market/*`**：数据源 `fact_conv_appmarket`（明细）+ `agg_vendor_daily`（创意），双源。
- **`POST /api/v1/reports/omni-channel/daily-calendar`**（v3.1.5+）：过去 N 天每日开户热力图数据（默认 365，范围 7..366）。
- **`/api/v1/data-freshness`**：返回 5 张新表数据状态（`critical` >14d / `warning` >5d / `normal` ≤5d）。
- **bizModel 推断**：`backend_conversions` 的 `business_model` 用 `customer_source` 推断。
- **代理商分析小计 / 合计行**：`agency_analysis.py` 响应里带 `is_subtotal`/`is_total` 字段，前端展示指标卡片需跳过。
- **`@ant-design/plots` 漏斗图**：通过 `ErrorBoundary` 降级到 CSS 横条漏斗；数据传入前 `clean.filter(d => typeof d.count === 'number' && Number.isFinite(d.count))`。
- **打包**：`省心投启动器.exe`（gitignored，7.7MB，PyInstaller 产物）+ `python-3.9-embed/` + `lib/` 便携版结构；dev 环境双击 exe 自动 fallback 到 `.venv/Scripts/python.exe`。
- **orval**：不要手改 `src/types/api.ts`，必须通过 `npm run generate:api` 重新生成。
- **`d.toISOString()` 时区陷阱**：`+8` 时区下 `new Date(2026, 0, 1).toISOString()` 返回 `'2025-12-31T16:00:00.000Z'`（UTC 前一天的下午），`slice(0,10)` 会取到前一天的日期。构造本地日期字符串请使用 `d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0')`。CalendarHeatmap 热力图已因此 bug 导致周几错位。
- **数据源**：v2 上传识别 6 个新类型（account_mapping / conversion_content / conversion_appmarket / vendor_daily / xhs_note / channel_open）→ 旧 7 个类型 → 410 Gone。
- **Swagger**：`/apidocs` 可选（需装 flasgger，未列在 requirements.txt），app.py 已做 ImportError 容错。
- **一次性脚本**：`scripts/_write_docs.py` / `_patch_creative.py` 等保留在 `scripts/` 下，不进 git 索引，使用时按需。

## 9. 修改守则

- **React 运行时 XXX is not defined 错误排查**：这类错误通常不是 Ant Design 版本问题，而是：① Vite HMR 缓存导致旧模块未被及时替换（刷新页面或 
pm run build 即可）；② const / let 定义在前（TDZ 暂存死区），但被前面定义的 useState/useCallback scope 内的函数在闭包中引用。修复方法：把 const loadData / const doSomething 提到组件的 useState 初始化之后、其它内部函数（pplyFilters / 
esetFilters）之前。③ 使用 import { X } from 'antd' 时确保 X 确实从 antd 导出（如 Typography 在 antd v5 要从 ntd 而非独立路径导入）。④ 组件文件有 BOM（UTF-8 BOM）时 Vite 解析可能静默截断模块导出，在全体 TSX 文件中统一使用 UTF-8 without BOM。

- 修改 `AGENTS.md` 或 `CLAUDE.md` 必须保持两者内容完全一致（SHA256 一致）。
- 修改业务查询前，先确认端点当前使用的源表和口径，不要照搬 README 或旧文档的过期描述。
- 不要改 `models_v2.py` 的中文列名来迎合前端字段；这些列名要与源表 / `to_sql` 结果对齐。
- 不要新增 mapping / 归一化 processor；确需处理新数据源时，优先补充上游 ETL 或 v2 原样导入映射。
- 不要复活旧上传类型、旧 v1 表、旧原生前端目录或历史迁移脚本。
- 不要手改生成文件，尤其是 orval 生成的 `src/types/api.ts`。
- 报表头部数据卡片一律使用 `MetricCard + MetricSection`；禁止在 page 内重新实现 `Card + Row/Col` 卡片组（小红书运营报表与 EmployeeConversion 周报海报子系统除外）。
- **数据源 / 端点 / 口径说明一律放进 `ReportFooter`**，不要在 MetricCard 的 `description` 或筛选卡里重复。
- 渲染 Excel 导入的脏字符字段前先走 `sanitizeText()`。
- 设备明细 / 线索明细等行级数据支持详情浮窗（`Modal + Descriptions column={2}`），参考 `LeadsDetail` 模式。
- 主播分析：同名主播按 anchor 跨平台前端聚合；总资产只累加 `opened > 0` 行的 `assets`；`pagination={false}` 一页呈现。
- 侧栏菜单多时 `.sider` 用 `overflow-y: auto` 滚动，禁用 `overflow: hidden`。
- `GuideModal` 必须校验 `content-type: text/markdown`，避免后端 SPA 兜底 `index.html` 被 ReactMarkdown 当 md 渲染成乱码；`GUIDE_TITLES` 增补 6 个 v2 新类型映射。
- WebDAV 错误粒度：网络层 → 502 + UPSTREAM_UNAVAILABLE；其它 → 500 + LIST_FAILED。
- 提交前确认：未把本地数据库 / 上传文件 / 备份文件 / `prototype/` / `tmp_*` / `logs/bug-fix-shots/` 加入索引；`.env` 与 `database/*.db` 已被 `.gitignore` 排除。
- **前端 import 交叉验证（防 RuntimeError 黄金守则）**：向 React 文件新增任何 antd 组件或 @ant-design/icons 图标时，立即检查该文件的 import 区是否同步引入了这些 API；新增 JSX 中使用了 `Button`、`Typography`、`SearchOutlined` 等但 import 缺失会导致 dev server 运行时 `ReferenceError: X is not defined`。修改完成后手动 grep 或扫一遍文件头 20 行确认 import 齐全。
- **函数/变量名交叉验证**：`onClick`、`onChange` 等回调中引用的函数名（如 `load`、`resetFilters`、`handleSearch`）必须在文件同作用域内有 `const xxx =` 或 `function xxx()` 定义。新增按钮引用已有函数时，先 grep 确认函数名精确匹配。ConversionFunnel 曾因此类问题出现 `load is not defined`——函数实际名为 `loadData` 而非 `load`、按钮却写了 `onClick={load}`。
- 文档只描述当前真实状态；如果代码、`version.json`、README 冲突，**以代码和 `version.json` 为准**，并在文档中标注滞后点。

## 10. 验证建议

- 后端改动：优先跑相关端点的最小 smoke（如 `curl -X POST ...`），再视情况启动 `python app.py`；如果修改了 `backend/routes/*` 而 Flask 进程仍在跑，需手动重启。
- 前端逻辑 / 类型改动：优先跑 `npm run typecheck`，再跑 `npm run lint` 与必要页面 smoke。
- 前端样式改动：结合浏览器检查日/夜主题、报表头部卡片、表格和筛选栏；不要只看构建结果。
- 全量验证成本较高时，在最终说明里明确已跑和未跑的命令。
- **生产前端没看到最新代码**：先 `cd frontend-react && npm run build`，5000 端口不需要重启 Flask；确认 vite build 无 error 后再 curl 资源大小对比 dist 时间戳。

## 11. 文档索引

- `README.md`：项目简介 + 核心能力（不含版本说明）。
- `docs/v3.1_报表重梳方案.md`：v3.1 菜单 / 双漏斗 / 双源 / 应用市场 / 直播占位设计。
- `docs/库表重构设计_v2.md`：v2 DIM/DWD/DWS 设计基线。
- `docs/库表重构设计_v3.md`：v3 实施与收尾对账。
- `docs/前端UI优化规划PRD.md`：v3.1.1 设计 token / 日夜模式 / 样式治理规划与验收标准。
- `docs/前端全栈改造清单.md`：React 迁移要点。
- `docs/数据库架构文档.md`：旧 13 表说明，查新表时优先看 v2/v3 重构文档。
- `docs/部署指南.md`：开发、生产、Docker、性能优化、监控与故障排查。
- `docs/uploads_cleanup_guide.md`：上传目录清理指引。
- `docs/*_legacy.md`：历史归档，仅作参考。
