# 省心投 BI 项目文档（AGENTS / CLAUDE）

> 本文件是仓库根目录的项目工作说明。`AGENTS.md` 与 `CLAUDE.md` 应保持同一内容；修改其中一份时必须同步另一份。
> 本地工作目录：`D:/AIproject/省心投BI`，默认环境：Windows + PowerShell。

## 1. 项目概况

省心投 BI 是券商财富管理场景下的互联网广告投放 + 开户转化数据分析平台，定位是「数据存储 + 查询聚合 + 可视化呈现」。原始数据的 mapping / 清洗 / 归一化 / 漏斗预计算由上游 ETL 完成，下游只做原样入库 + SELECT 聚合 + 报表展示。

- 后端：Python Flask + SQLAlchemy + SQLite + pandas 原样导入（`to_sql(replace)`）。
- 前端：React 19 + TypeScript + Vite + Ant Design 5/6 + @ant-design/plots / @ant-design/charts + ECharts + Zustand。
- 当前版本基线：`version.json` 为 `3.2.5`（2026-07-17）。版本号规则：MAJOR.MINOR.PATCH，PATCH 为个位数（0-9），到 9 后进位到 MINOR。

## 2. 产品与数据方向

**只做数据存储 + 查询聚合 + 可视化呈现，不在本项目继续做业务 mapping / 清洗 / 归一化 / 字段补全。**

- 上游 ETL 负责业务清洗、规范化、字段补全、漏斗预计算与口径修正。
- 后端导入只做文件读取、空值处理、日期/布尔/ID 的格式层安全处理，外加 `pandas.to_sql(if_exists='replace')` 原样落库。
- 查询端点可以做 SELECT、SUM、GROUP BY、分页和兼容派生字段，不要新增下游业务口径修补逻辑。
- 新数据类型必须走 v2 原样导入入口：`backend/processors/v2/raw_import.py`。
- 旧 v1 上传类型已退役并返回 410 Gone，不要复活旧 processor 或旧表链路。

### 业务洞察：新开户 vs 存量客户（核心业务区分，贯穿所有获客类报表）

本项目所有获客类报表的核心业务诉求是「新增」——新开户客户及其引进资产是核心产出指标，存量客户的服务与存量资产仅作辅助参考。两者必须分开分析，不能混算。

- **新开户**：首次在省心投完成开户的客户，带来新增开户量 + 引进资产。
- **存量客户**：已开户的老客户（含他渠道开户后在本渠道再次出现），其开户量/资产属于存量服务，不代表新增获客。
- **核心规则**：凡涉及「开户成功」指标的报表，都应进一步拆出「新开户」——开户成功 = 新开户 + 存量客户。漏斗 / 对比 / 创意 / 员工转化 / 直播获客均适用。

#### 应用市场漏斗（fact_conv_appmarket）的存量剔除陷阱

`fact_conv_appmarket` 每行是一个**设备**，其布尔阶段字段（是否激活APP / 是否开户注册 / … / 是否开户成功）是**渐进的**——一个走完全流程的设备，前置阶段字段全=1。

**错误做法**：用 `WHERE 是否新开户 == 1` 过滤结果集。因为「是否新开户=1」的设备必然已开户成功（开户是新开户的前置），过滤后所有行的前置阶段字段全=1，SUM 后「激活APP → 开户注册 → … → 开户成功」全部相等，漏斗变平。

**正确做法**：不过滤，将「新开户」作为「开户成功」之后的漏斗阶段呈现（开户成功 → 新开户 → 入金 → 有效户）。存量客户 = 开户成功 - 新开户，在漏斗中自然递减。

#### 应用市场渠道类型过滤的必要性（互联网引流 vs 误点）

`fact_conv_appmarket.渠道类型` 区分获客来源：**互联网引流** = 应用市场广告投放获取的真实线索；**其它渠道类型**（合作机构/员工开户/自然流入等）= 客户经其他渠道引流后下载 APP 时误点了应用市场广告，并非应用市场广告真正获客。

- 非互联网引流的设备线索与存量客户一样需剔除——它们不是应用市场广告的真实产出。
- 应用市场所有报表统一走 `_funnel_filters`（强制 `WHERE 渠道类型 == '互联网引流'`），不允许走 `_apply_filters`（后者会带 channel_types 筛选但不强制限互联网引流）。
- 口径锁定后前端的「渠道类型」筛选项应移除（筛选无意义，口径已固定）。

> 已修复（v3.1.25）：
> - `backend/routes/data/cost_analysis.py` `conversion-funnel/split` + `backend/routes/reports/app_market.py` `_funnel_filters` 均移除 `是否新开户 == 1` 过滤。
> - `backend/routes/reports/app_market.py` `app_market_creative` 从 `_apply_filters` 改走 `_funnel_filters`（限互联网引流），funnels 加「新开户」SUM，totals/排序以新开户为核心产出。
> - `frontend-react/src/pages/Reports/AppMarket/Creative.tsx` 移除渠道类型筛选项，加「总新开户」指标卡 + 「新开户」列 + 「激活→新开户」率 + 默认按新开户降序。

#### 内容平台漏斗（fact_conv_content）的存量剔除

`fact_conv_content` 每行是一条**线索**，布尔字段（是否客户开口 / 是否有效线索 / 是否开户）在该行仍可能=0（新增量客户的线索也可能没开口/没开户），漏斗仍递减。

v3.1.25 起，内容平台漏斗的存量剔除在**有效线索之后**发生：有效线索（含存量）→ 有效线索(剔除存量) → 成功开户 → 有效户。`cq_all` 统计线索/开口/有效线索（全部记录），`cq_new` 加 `WHERE 是否为存量客户 != 1` 统计有效线索(非存量)/成功开户/有效户。这样漏斗呈现存量剔除效果，后续阶段只反映新客户。

#### 各报表口径要求（含待修复项）

- **应用市场 · 漏斗/总览/市场对比/明细/创意**：统一走 `_funnel_filters`，仅限 `渠道类型=互联网引流`，新开户作为阶段/指标呈现。✅ 市场对比表已展示「新开户」列 + 「激活→新开户」率 + 月度堆叠图改用新开户。
- **应用市场 · 创意效果**（`/creative`）：✅ 已修复（v3.1.25）——走 `_funnel_filters` + 新开户 SUM + 前端新开户指标卡/列/默认排序。
- **员工转化 / 直播获客 / 小红书**：涉及开户量、资产指标时，新开户（新增 + 引进资产）与存量客户（服务 + 存量资产）分开呈现，新开户为主指标、存量为辅助。

## 3. 共享组件

| 组件                             | 路径                                                    | 职责                                                  |
| ------------------------------ | ----------------------------------------------------- | --------------------------------------------------- |
| `MetricCard` / `MetricSection` | `frontend-react/src/components/MetricCard/`           | 单张指标卡 + 卡组容器（响应式 4/3/2/1）                           |
| `ReportFooter`                 | `frontend-react/src/components/ReportFooter/`         | 报表页底部弱化区，集中展示数据源 / 端点 / 口径说明                        |
| `FunnelChart`                  | `frontend-react/src/components/Chart/FunnelChart.tsx` | `@ant-design/plots` Funnel + ErrorBoundary CSS 横条降级 |
| `CalendarHeatmap`              | `frontend-react/src/pages/Dashboard/components/`      | 蓝色 5 档 `l0..l4` 开户日历热力图                             |
| `sanitizeText`                 | `frontend-react/src/utils/sanitizeText.ts`            | 客户端文本清洗：剥 BOM / NUL / 控制字符 / `�` / 零宽               |

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
│   ├── system/                # v3.1.17 新增 self_update（git-status / start / status）
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

### 代码规范

- **`models_v2.py` 列名含中文**（如 `AggVendorDaily.花费`、`FactConvContent.微信昵称`），SQLAlchemy 用 `Text`/`BigInteger`/`Float`，**禁止改列名以匹配业务字段**。
- **报表头部数据卡片一律 `MetricCard + MetricSection`**；禁止在 page 内重新实现 `Card + Row/Col` 卡片组（小红书运营报表 XhsNotes/Operation 与 EmployeeConversion Weekly 周报海报子系统除外）。
- **数据源 / 端点 / 口径说明一律放进 `ReportFooter`**，不要在 MetricCard description 或筛选卡里重复。
- **代理商字段三态**：`DimVendor` 含 `agency_name`（全称）、`agency_short`（简称/显示名）、`agency_letter`（拼音简称）。`agg_vendor_daily.厂商` 和 `fact_conv_content.广告代理商` 存的是**全称**。同一代理商在不同平台全称可能不同，但**简称是共同的**。

### 前端踩坑

- **antd `Table` columns 缺 `dataIndex`**：列未设 dataIndex 时 `render(v)` 拿到的 `v` 是整行 record，对象恒 truthy → bool 列全部显示"是"（AppMarket/Detail v3.1.20 修复）。
- **`d.toISOString()` 时区陷阱**：+8 时区下 `new Date(2026, 0, 1).toISOString()` 返回 UTC 前一天，`slice(0,10)` 会取到前一天日期。构造本地日期串用 `d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate())`。CalendarHeatmap 曾因此周几错位。
- **`@ant-design/plots` 漏斗图**：通过 `ErrorBoundary` 降级到 CSS 横条漏斗；数据传入前需 `filter(d => typeof d.count === 'number' && Number.isFinite(d.count))`。
- **报表 `.page` padding 全站统一为 0**（v3.1.19 fix）：外层由 MainLayout / ConfigProvider 提供统一间距，新建页面禁止再加 padding。
- **React 运行时 `XXX is not defined` 排查**：通常不是 antd 版本问题，而是：① Vite HMR 缓存（刷新或 rebuild）；② const/let TDZ 暂存死区（把变量定义移到 useState 之后、内部函数之前）；③ UTF-8 BOM 导致 Vite 静默截断模块导出。
- **乱码防御**：渲染 Excel 导入的脏字符字段（主播名 / 来源 / 备注等）前走 `sanitizeText()`，防止上游 GBK / 控制字符渲染成方块。

### 后端踩坑

- **Flask 后台线程不能用 `current_app`**：子线程不自动继承 app context，拿配置或 version 时必须 `with app.app_context():`，或用纯函数绕开（`_read_version_json()` / `_run_git()`）。
- **`git pull` 前检测 dirty 工作区**：未 commit 的改动会让 pull 失败；force=true 时先 `git stash push -u` 暂存再 pull，成功后 `git stash pop` 恢复（冲突时保留 stash 供手动处理）。

### Windows / 环境踩坑

- **`subprocess.run` 弹 cmd 黑窗**：默认继承 console，git 调用每次闪黑窗。修复：`creationflags=0x08000000`（CREATE_NO_WINDOW），子进程静默执行。
- **orval 生成的 API 类型**：不要手改 `src/types/api.ts`，必须通过 `npm run generate:api` 重新生成。
- **一次性脚本不进 git**：`scripts/_*.py` 保留在本地，`.gitignore` 已排除。

## 9. 修改守则

- 修改 `AGENTS.md` 或 `CLAUDE.md` 必须保持两者内容完全一致（SHA256 一致）。
- 修改业务查询前，先确认端点当前使用的源表和口径，不要照搬 README 或旧文档的过期描述。
- 不要改 `models_v2.py` 的中文列名来迎合前端字段；这些列名要与源表 / `to_sql` 结果对齐。
- 不要新增 mapping / 归一化 processor；确需处理新数据源时，优先补充上游 ETL 或 v2 原样导入映射。
- 不要复活旧上传类型、旧 v1 表、旧原生前端目录或历史迁移脚本。
- 不要手改生成文件，尤其是 orval 生成的 `src/types/api.ts`。
- 报表头部数据卡片一律使用 `MetricCard + MetricSection`；禁止在 page 内重新实现 `Card + Row/Col` 卡片组（小红书运营报表与 EmployeeConversion 周报海报子系统除外）。
- 数据源 / 端点 / 口径说明一律放进 `ReportFooter`，不要在 MetricCard 的 `description` 或筛选卡里重复。
- 渲染 Excel 导入的脏字符字段前先走 `sanitizeText()`。
- 设备明细 / 线索明细等行级数据支持详情浮窗（`Modal + Descriptions column={2}`），参考 `LeadsDetail` 模式。
- 主播分析：同名主播按 anchor 跨平台前端聚合；总资产只累加 `opened > 0` 行的 `assets`；`pagination={false}` 一页呈现。
- 侧栏菜单多时 `.sider` 用 `overflow-y: auto` 滚动，禁用 `overflow: hidden`。
- `GuideModal` 必须校验 `content-type: text/markdown`，避免后端 SPA 兜底 `index.html` 被 ReactMarkdown 当 md 渲染成乱码；`GUIDE_TITLES` 增补 v2 新类型映射。
- WebDAV 错误粒度：网络层 → 502 + UPSTREAM_UNAVAILABLE；其它 → 500 + LIST_FAILED。
- 提交前确认：未把本地数据库 / 上传文件 / 备份文件 / `prototype/` / `tmp_*` / `logs/bug-fix-shots/` 加入索引；`.env` 与 `database/*.db` 已被 `.gitignore` 排除。
- **前端 import 交叉验证（黄金守则）**：向 React 文件新增 antd 组件或图标时，立即检查 import 区是否同步引入；新增 JSX 中使用了 `Button`、`SearchOutlined` 等但 import 缺失会导致运行时 `ReferenceError: X is not defined`。
- **函数/变量名交叉验证**：`onClick`、`onChange` 等回调中引用的函数名必须在同作用域内有 `const xxx =` 或 `function xxx()` 定义。ConversionFunnel 曾因此类问题出现 `load is not defined`——函数实际名为 `loadData`。
- 文档只描述当前真实状态；如果代码、`version.json`、README 冲突，**以代码和 `version.json` 为准**，并在文档中标注滞后点。

## 10. 自动化测试体系

### 测试金字塔（从上到下：量少 → 量多，慢 → 快）

```
    /  全量功能测试（Playwright，手动触发）  \   约 10~30 分钟
   /    回归测试（历史 bug 复现）               \   按需
  /      冒烟测试（路由 + API）                  \   < 1 分钟
 /        类型检查 / 构建验证                     \   < 1 分钟
```

### 各层级说明

| 层级 | 命令 | 时机 | 耗时 | 覆盖 |
|---|---|---|---|---|
| **类型检查** | `cd frontend-react && npm run typecheck` | 每次改前端 | < 30s | TS 类型 |
| **构建验证** | `cd frontend-react && npm run build` | 提交前必跑 | ~45s | 前端编译 |
| **API 冒烟** | `python -m unittest discover -s tests/api` 或 `scripts/test-api-smoke.bat` | 改后端必跑 | ~1s | 34 个核心接口 |
| **路由冒烟** | `cd frontend-react && npm test` | 改路由/页面必跑 | ~1min | 19 个公开路由 |
| **功能测试** | `cd frontend-react && npm run test:functional` | 发版前手动 | 较长 | 16 个页面 |
| **全量测试** | `scripts/run-full-tests.bat` | 发版前手动 | 10~30min | API + 构建 + 功能 |

### 目录结构

**后端测试（tests/api/）**：
- `tests/api/test_smoke.py` — API 冒烟测试（unittest，零新增依赖）
- 覆盖：health、version、metadata、data-freshness、dashboard×3、trend、conversion-funnel×2、agency-analysis、cost-analysis、weekly×3、omni-channel×3、app-market×3、employee-conversion×2、leads、xhs-notes×2，共 34 个接口
- 设计原则：只读、不写库、Flask test_client 内存执行

**前端测试（frontend-react/tests/）**：
- `smoke/` — 路由冒烟（route-health.spec.ts，19 个路由）
- `functional/` — 页面级功能测试（16 个页面 spec）
- `regression/` — 历史 bug 回归用例（新增 bug 时补）
- `comparison/` — 新旧版对比测试（历史遗留，保留备查）
- `_helpers/` — Python 辅助脚本、截图对比工具
- `_legacy/` — 旧版零散 spec，功能已被 functional 覆盖

### 提交前快测（pre-commit check）

双击运行 `scripts/pre-commit-check.bat`，自动执行：
1. 后端 API 冒烟（34 个接口，~1s）
2. 前端构建（vite build，~45s）

全部绿灯才允许提交。

### 全量功能测试（手动触发）

双击运行 `scripts/run-full-tests.bat`，自动执行：
1. 后端 API 冒烟
2. 前端构建
3. Playwright 全量功能测试（16 个页面）

**仅在发版前运行**，平时不需要跑。

### 新增测试的原则

- **每修复一个 bug**：在 `tests/regression/` 加一个对应的回归用例
- **每新增一个核心接口**：在 `tests/api/test_smoke.py` 加一条 smoke
- **每新增一个 lazy 路由**：在 `tests/smoke/route-health.spec.ts` 加一条路由
- **冒烟测试要快**：单条 < 1 秒，不做复杂业务断言，只验证 200 + 结构合法

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



### v3.1.24 已落地（2026-07-16）

- **转化漏斗业务规则统一（5 项）**：
  - **内容平台核心指标加"成功开户"卡**：ConversionFunnel/index.tsx 在"客户开口"MetricCard 后插入"成功开户"MetricCard（`AimOutlined` + `var(--chart-color-3)`），显示 `contentMetrics.opened`（即 `fact_conv_content.是否开户` SUM）。
  - **阶段转化详情新增"阶段转化率"列**：两张 stageTable thead/tbody 在"累计人数"和"累计转化率"之间插入"阶段转化率"列。`stage.rate = 此阶段 / 上一阶段`、`stage.step_rate = 此阶段 / 顶端`，分别用不同色阶 Tag 渲染。后端 cost_analysis.py 把 contentStages + appmarketStages 全部补齐 `rate` + `step_rate` 两个语义字段，并把 list comprehension 改为显式 for 循环保证 prev_count 正确传递。
  - **应用市场漏斗限定"渠道类型=互联网引流 + 是否新开户=1"**：app_market.py 新增 `_funnel_filters(q, filters)`（在 `_apply_filters` 后追加 `FactConvAppmarket.渠道类型 == '互联网引流'` + `FactConvAppmarket.是否新开户 == 1`），`/summary` (total + month_market + by_market 三个子查询) 和 `/funnel` 两个端点改为走 `_funnel_filters`；detail / comparison / by_channel_type 继续走 `_apply_filters` 不受影响。
  - **内容平台漏斗排除存量客户仅看新开户**：cost_analysis.py 的 `cq` 查询在 `平台来源.in_(platforms)` 后追加 `or_(FactConvContent.是否为存量客户 == 0, FactConvContent.是否为存量客户.is_(None))`，让聚合口径只看新开户。
  - **应用市场 9 阶段文案同步 + Reports/AppMarket/Funnel.tsx 口径/样式与转化漏斗页对齐**：appmarketStages 显式插入"新开户"阶段（`stage_cols.insert(6, ('新开户', FactConvAppmarket.是否新开户))`）；Funnel.tsx 加 `useLogScale`，详情卡从 `div.funnelList` 改为 `table.stageTable + colNum`（同 ConversionFunnel 风格），文案升级到 9 阶段并标注 `_funnel_filters` 业务限制；AppMarket/index.module.scss 追加 `.stageTable + .colNum` 样式块。

- **修复**：之前 `appmarket_stages` 用 `lambda prev=base:` 把 rate 写成"此阶段 / 激活APP"（语义错位 = 累计转化率），已改为 for 循环正确计算 `prev_count`（上一阶段人数）。Reports/AppMarket/Funnel.tsx 调用顺序未受影响。

- **build**：`npx tsc --noEmit` 0 错；`npm run build` 0 错。

### v3.1.26 已落地（2026-07-16）

- **直播漏斗存量剔除 + 同名主播跨平台聚合 + 转化漏斗 4 卡概览（3 项）**：
  - **直播漏斗 6 阶段 + 11 卡概览（Live/Funnel.tsx）**：原 5 阶段 → 6 阶段（客户线索 → 客户开口 → 有效线索 → 有效线索(剔除存量) → 成功开户(新) → 有效户(新)），与 `cost_analysis/conversion-funnel/split` 存量剔除口径对齐（非存量 = `是否为存量客户==0 OR IS NULL`）。指标卡从 6 张扩到 11 张，新增「存量客户」「新客户」「有效线索(剔除存量)」「新开户」「新有效户」「新开户资产」「存量资产」7 张分项卡。
  - **后端 leads.py `anchor-clusters` 端点扩字段**：`base_q` 新增 `existing_leads`（`是否为存量客户==1` 线索 SUM）/ `new_leads`（非存量线索 SUM）/ `new_valid_lead`（非存量且有效线索 SUM）/ `new_opened`（非存量且开户成功 SUM）/ `new_valid`（非存量且有效户 SUM）/ `new_assets`（非存量客户资产 SUM）/ `existing_assets`（存量客户资产 SUM）7 个 SQL 字段；`agg_map`/`items`/`totals` 同步扩到 14 字段；`meta.note` 说明存量客户线索与资产分项辅助呈现。
  - **同名主播跨平台聚合**：前端 `anchorAggRows` 按 `anchor` 名跨平台聚合，主播详情表展示「覆盖平台」（多 Tag）+「平台数」列，响应上方「主播平台」多选筛选。后端 32 个 platform-anchor 组合，去重后 22 位主播（7 位跨平台：谭记恩/胡磊/余荩 各 3 平台，蒋亦凡/赵茜 各 2 平台）。
  - **转化漏斗 4 卡概览对齐应用市场**：ConversionFunnel/index.tsx 两个 Tab 的 MetricSection 从 5/4 卡 → 4 卡，与 `Reports/AppMarket/Funnel.tsx` 概览对齐：
    - 内容平台：客户线索 / 新开户 / 有效户 / 新开户引进资产
    - 应用市场：激活APP / 新开户 / 有效户 / 新开户引进资产
  - **后端 cost_analysis.py `conversion-funnel/split` 新增 `new_open_assets`**：内容平台 = `非存量 AND 是否开户==1, SUM(资产)`；应用市场 = `是否新开户==1, SUM(总资产)`（口径与 `app_market.py` 一致）。响应 `funnels.content.new_open_assets` 与 `funnels.appmarket.new_open_assets`。
  - **Live/Funnel.module.scss 新增 `.stageTable + .colNum` 样式**：阶段明细表与 ConversionFunnel 风格对齐（`table-layout: fixed` + 行高 hover 反色 + 数字列右对齐 + tabular-nums）。
  - **ReportFooter 补存量剔除口径说明**：直播漏斗页脚加「非存量 = 是否为存量客户==0 OR IS NULL，与 cost_analysis/conversion-funnel/split 一致」「新开户作为核心获客产出，存量客户线索数与存量资产作为辅助呈现」。
- **校验**：Python smoke `POST /api/v1/leads-detail/anchor-clusters`（2026-01-01 ~ 2026-12-31, top_n=200）→ `total_existing_leads=1703`、`total_new_leads=13052`、`total_existing_assets=¥1,467,064,484.80`、`total_new_assets=¥25,310,560.28`、`total_anchors=32`；`POST /api/v1/conversion-funnel/split` → `content.new_open_assets=143,091,131.4`、`appmarket.new_open_assets=514,198,150.22`。`npx tsc --noEmit` 0 错；`npm run build` 0 错（5988 modules）。

### v3.1.27 已落地（2026-07-16）

- **主播分析菜单对齐直播漏斗业务口径**：AnchorCluster/index.tsx 复用 `anchor-clusters` 端点（v3.1.26 已扩字段），前端再按 anchor 名跨平台聚合（同名主播合并为一行）。
  - **概览卡片 5 张 → 11 张**：新增「存量客户」「新客户」「有效线索(剔除存量)」「新开户」「新有效户」「新开户资产」「存量资产」7 张分项卡，与 Live/Funnel 概览口径完全一致。`totals` 改为基于 `anchorAggRows` 去重后聚合（与明细表口径一致），避免 `total_anchors=32`（platform-anchor 组合数）误显示为主播数（实际去重后 22 位）。
  - **明细表聚合逻辑补全**：原前端聚合只累加 `opened/valid/assets` 等旧字段，新字段 `existing_leads/new_leads/new_valid_lead/new_opened/existing_opened/new_valid/existing_valid/new_assets/existing_assets` 全部缺失。改为 `anchorAggRows` useMemo 按 anchor 名跨平台聚合，累加全部 14 字段；`opening_rate` 改用 `new_opened / leads`（新口径）。
  - **明细表列扩充**：从 11 列扩到 20 列，新增「存量客户/新客户/有效(非存量)/开户量(全)/新开户/存量开户/有效户(全)/新有效户/新开户资产/存量资产/总资产」等列；「覆盖平台」列改为多 Tag 展开 + 「平台数」列。
  - **筛选器**：保留「主播平台」多选筛选 + 「主播」多选筛选（支持搜索），`anchorAggRows` 响应两个筛选器。
  - **CSV 导出**：headers 从 9 列扩到 21 列，含主播/覆盖平台/平台数/线索量/存量客户/新客户/开口/有效线索/有效(非存量)/开户量(全)/新开户/存量开户/有效户(全)/新有效户/存量有效户/新开户率/新有效率/新开户资产/存量资产/总资产/线索来源。CSV 字段转义（含 `,` `"` `\n` 的字段用双引号包裹，内部 `"` 翻倍）。
  - **ReportFooter 补口径说明**：加「存量剔除口径」「主播聚合」两项，notes 说明新开户作为核心获客产出。
- **校验**：`npx tsc --noEmit` 0 错；`npm run build` 0 错（5988 modules，37s）；dist grep 命中「主播分析概览/有效线索(剔除存量)/新开户资产」。


### v3.1.25 已落地（2026-07-16）

- **4 项 UI/工程修复**：
  - **直播获客漏斗卡片超出容器**：Live/Funnel.tsx 把 11 张 MetricCard 拆成两个 MetricSection — `直播获客核心产出`（主播数 / 新客户 / 新开户 / 新有效户 / 新开户资产）+ `全量主播引流明细`（含存量客户与存量资产作辅助参考）；同时给 `MetricCard.module.scss` 的 `.metricCard` 加 `min-width: 0; overflow: hidden` 防 grid item 被内容撑破容器，`.metricValue` 加 `text-overflow: ellipsis` + `.metricNumber` 同上保证数字溢出截断。4 列 grid 浏览器尺寸 < 1200 / < 768 / < 576 自动 3/2/1 列降级保持不变。
  - **员工转化周报默认海报视图**：Weekly/index.tsx 加 `viewMode: 'poster' | 'text'` + `posterPlatform` 两个 useState（默认 poster / 小红书），工具栏加 Segmented 切换 + 平台 Select；PosterModal.tsx 加 `mode?: 'modal' | 'inline'` prop（默认 modal），用 `const inner = (<>...</>); if (mode === 'inline') return inner` 拆分，海报 DOM 与浮动 PNG/PDF 工具栏天然可在主页面内复用。原 PosterExportButtons 退化为可选 Modal 入口。
  - **小红书运营报表导出修复**：Operation.tsx html2canvas 的 `backgroundColor: 'var(--bg-page)'` html2canvas 不解析 → 改用 `document.documentElement.classList.contains('dark') ? '#0f1419' : '#ffffff'` 实色，scale 2 降到 1.5 避 canvas 内存炸，`windowWidth/Height` 锁滚动尺寸，`allowTaint: false`；catch 块把 `error.name / message` 拼进 message 详情 6 秒 toast。
  - **路由层 errorBoundary 兜底 + 冒烟测试自动化**：新建 `frontend-react/src/components/RouteErrorBoundary/index.tsx` 区分 404 / 5xx / `Failed to fetch dynamically imported module|ChunkLoadError|Importing a module script failed` 三类错误并提供刷新本页 / 返回首页两按钮；`router/index.tsx` 根路由加 `errorElement: <RouteErrorBoundary />`；新建 `frontend-react/tests/route-health.spec.ts` 遍历 19 个公开路由用 Playwright 兜底断言"页面进入后 RouteErrorBoundary 不可见、pageerror 列表无动态 import 失败"。

- **冒烟测试基础设施**：`tests/route-health.spec.ts` 是 v3.1.25 起每个版本提交前的硬性验收（`npm run test`），跑通才允许 commit；后续 lazy 路由改动必须保证这个 spec 绿灯。


## 12. 开发服务器一键启停（v3.1.25+）

- **启动**：`scripts/start-dev.bat`（双击或 PowerShell 调）。脚本会先 netstat 检查 :5000/:3000 是否被占，被占用直接退出提示先 stop，避免端口冲突。
- **停止**：`scripts/stop-dev.bat`。优先读 `logs/dev-pids/*.pid`，找不到 PID 文件时回退到按端口找进程并 kill。
- **日志**：`logs/app.log`（Flask）、`logs/vite-dev.log`（Vite）。PID 落到 `logs/dev-pids/`。
- **生产前端看不到最新代码**：先 `cd frontend-react && npm run build`，5000 端口不需要重启 Flask；然后**重启 Vite**（用 `stop-dev.bat` + `start-dev.bat`），让 :3000 走最新 dist 的代理配置。
- **背景**：v3.1.23~v3.1.25 期间多次出现"3000/5000 同时不可用"问题——根因是 `Start-Process -WindowStyle Hidden` 启的 Python Flask 进程在父窗口关闭时被带跑，Vite node 子进程 HMR 链断后未重新 listen。一键 .bat 把启动方式固化，避免脚本一关就掉。
- **不使用 .bat 的情况**：临时调试可用 `Start-Process python app.py -WindowStyle Hidden` 启 Flask，临时启 Vite 用 `cd frontend-react && npm run dev`，但要意识到窗口关闭 = 进程终止。





## 13. 版本历史

### v3.2.5 已落地（2026-07-17） 系统性 UI 动效优化（数据呈现生动化）

- **新增动效 Design Token**：`tokens.css` 追加 `--motion-duration-*`、`--motion-easing-*`、`--motion-stagger-gap`，统一全站动效时长与缓动曲线。

- **图表入场动画**：`EChartsComponent` 统一注入 `animationDuration: 800ms` + `cubicOut`；多 series 按索引 stagger delay 120ms；loading 状态从 Spin 改为 shimmer 骨架屏（`skeletonOverlay` + `skeletonShimmer`）。

- **指标卡动效**：
  - 新增 `useCountUp` hook，数字从 0 平滑增长到目标值，duration 800ms，easeOutQuart。
  - `MetricCard` 支持 `loading` 骨架屏；`MetricSection` 自动为子卡片注入 `index` 实现 stagger 入场。
  - hover lift 增强：`translateY(-3px)` + `shadow-elevated`。

- **全局交互反馈**：
  - 按钮悬浮上移 + 阴影；`ReloadOutlined` 图标按钮悬浮旋转 180°。
  - 卡片悬浮阴影提升。
  - 输入框 / 选择器 / 日期选择器 focus ring（`box-shadow: 0 0 0 3px var(--color-brand-bg)`）。
  - `Segmented` 切换时高亮条滑动。
  - 表格行 hover 背景过渡 + 排序图标 active 放大 1.2 倍。

- **漏斗图阶段展开**：`@ant-design/plots` Funnel 配置 `wave-in` appear 动画 + 索引递增 delay；降级 CSS 横条带宽度展开动画。

- **表格 shimmer loading**：新增 `SkeletonTable` / `AnimatedTable` 组件，加载时呈现结构骨架而非 Spin。

- **页面路由过渡**：引入 `framer-motion`，新增 `AnimatedOutlet` 组件封装 `AnimatePresence` + `m.div` 路由切换动画；`MainLayout` 改用 `LazyMotion` + `domAnimation` 按需加载动效运行时，避免引入完整 motion 包，主包 index 块从 1660 kB 降至 1613 kB。

- **可访问性**：全局支持 `prefers-reduced-motion: reduce`，自动关闭所有动画。

- **修复 7 个功能测试用例**（测试用例与当前页面结构不匹配，未改代码）：
  - 账号管理搜索功能：改用 `input[placeholder*="搜索"]` 实时过滤。
  - Dashboard 无数据场景：检查 MetricCard 数值而非表格。
  - 数据导入页 5 个用例：适配卡片网格选择器 + `Upload.Dragger`。

- **校验**：`npx tsc --noEmit` 0 错；`npm run build` 0 错（6391 modules，36s）；API 冒烟 33/33 通过。

### v3.2.4 已落地（2026-07-17） 小红书运营分析报表改造（Web/H5 双视图 + 数据准确性 + 杂志风数据块）

- **后端数据准确性（`backend/routes/data/xhs_operation.py`）**：
  - 三处查询（`agency_q` / `conv_q` / `emp_q`）补齐小红书平台筛选，原误取所有内容平台数据。
  - 创作量趋势按创作者堆叠柱状图且限 2026+（新增 `producer_matrix` 字段，原按日期折线为空）。
  - 整体转化走势改用 `fact_conv_content` 按周维度（上周五到本周四，`_week_label` 函数），原月维度每月只有一周数据。
  - 代理商数据改用 `agg_vendor_daily` 表（带 `小红书` 平台过滤），原取 `fact_conv_content` 投放金额字段口径错位。
  - 员工排行补齐小红书 8 人固定名单（史菡漾 / 何泳萍 / 杨华 / 贾芳 / 陈鸿 / 袁孝春 / 赵梅 / 张杰明），与 `员工转化-转化周报-小红书渠道` 榜单口径对齐。

- **前端布局简化（`frontend-react/src/pages/XhsNotes/Operation.tsx`）**：8 表 → 4 表 + 3 图，删除冗余「创作量趋势条形图」（与综合表内容重复）。

- **Web/H5 双视图模式**：
  - `viewMode: 'web' | 'h5'` state + `Segmented` 切换器，H5 模式参考 `ReportGeneration` 的 480px poster 容器。
  - 导出时自动切 H5 模式截图（`html2canvas` `scale: 2`，`jsPDF` 动态 `import` 分页），完成后恢复原模式。
  - H5 下业务转化漏斗 5 列 → 5x1 单列（`:global(.ant-col[style*='width: 20%'])` 强制 100%）；转化率/成本效率 4 卡 → 2x2 等高布局。

- **H5 表格 → 数据块（`renderH5Block` 通用函数 + 4 表各 3 核心字段）**：
  - H5 模式下不用表格（避免横向滚动条），改用数据块呈现，每块只放 3 个核心字段。
  - **修复**：创作者综合分析数据源从 `data?.creator_summary_data`（后端无此字段，导致 H5 无数据）改为前端 `useMemo` 合并的 `creatorSummaryData`（`creator_content_data` + `creator_conversion_data` 按 `producer` 合并，按 `total_cost` 降序）。
  - 优秀笔记 H5 模式限前 10 条（`.slice(0, 10)`，原 20 条过长）。

- **H5 数据块改杂志风（`Operation.module.scss`）**：删除左侧蓝色高亮条（`border-left: 3px solid`，AI 味重），参考 `ReportGeneration` 的 `.layerCard` / `.dataTable` / `.reportFooter li` 风格——
  - 顶部 2px 黑分隔线（首项 `:first-child`）+ 1px 灰线（后续 `border-top: 1px solid #e5e5e5`）。
  - 序号 `decimal-leading-zero`（01/02/…）+ `'JetBrains Mono'` + 品牌色 `#0052d9`，CSS counter 实现，DOM 无需 JSX 渲染序号。
  - 标题 `'Noto Serif SC'` 衬线 14px；数字 `'JetBrains Mono'` + `tabular-nums` 14px；标签 9px `uppercase` + `letter-spacing: 0.05em`。
  - 3 列固定 grid（`grid-template-columns: repeat(3, 1fr)`），每块正好 3 字段对齐。

- **筛选器对齐修复**：`filterRow` `align-items: flex-end` → `center` + `flex-wrap`；`filterActions` 由 `@include filter-actions`（`margin-left:auto`）改 `flex + align-items:center`，避免 `Segmented` 切换按钮与其它按钮不在一条线上；H5 下 `filterRow` 改 `flex-direction: column`。

- **其它一并修复**：
  - `员工转化-转化分析`：业务口径说明（内容平台客户统计范围）从顶部 `Alert` 移入 `ReportFooter` notes；删除「线索类型」筛选器（修复布局换行问题），API 调用 `lead_type: 'all'` 硬编码。
  - `互联网渠道数据概览`：删除「存量客户资产」卡片（前端 JSX + `GoldOutlined` import + `METRIC_COLORS.existingAssets` 三处清理，后端字段保留）。
  - `小红书笔记列表`（`List.tsx`）：删除 5 个源表 `agg_xhs_note` 不存在的字段。
  - `GuideModal`：所有「XX导入指南」改为弹窗内直接渲染内容（不依赖外部文档加载），修复点击问号提示「文档加载失败」。

- **校验**：`npx tsc --noEmit` 0 错；`npm run build` 0 错（5987 modules，~35s）。

### v3.2.3 已落地（2026-07-17） 修复报告生成页与互联网渠道数据概览「新增客户资产」数值不一致

- **根因**：报告生成页 `/api/v1/reports/weekly/data` 的 `_query_metrics` 用 DWD 明细层实时 SUM（`fact_conv_content.资产` 过滤 `是否开户=1 + 非存量` + `fact_conv_appmarket.总资产` 过滤 `是否新开户=1 + 互联网引流`），而互联网渠道数据概览页 `/api/v1/dashboard/core-metrics` 走 DWS 预聚合字段 `agg_vendor_daily.客户资产`。两端口径在 2026-01-01~2026-07-16 区间相差 16.75 万（DWD 多算，ETL 在 agg 表已做清洗剔除）。
- **修复**：`backend/routes/weekly_reports.py` 的 `_query_metrics` 改为直接 SUM `AggVendorDaily.客户资产`（并入现有 `ad_r` 查询，减少一次 SQL），与 `/dashboard/core-metrics` 完全对齐。同时清理未使用的 `FactConvAppmarket` / `or_` import。
- **验证**：新口径下两端口径数值完全一致（677,383,336.85）；API 冒烟 33/33 通过。

### v3.2.1 已落地（2026-07-17） 清理旧周报系统 + 冗余 DIM 表

- **删除 `weekly_reports` 表及 `WeeklyReport` ORM 模型**：旧周报系统存文案/重点工作/HTML，v3.1.31 起纯数据周报从 `agg_vendor_daily` / `agg_daily_channel_open` / `fact_conv_*` 实时聚合，不再依赖该表。
- **简化 `/periods` 端点**：去掉数据库查询，纯生成周次选项（旧逻辑会合并 `weekly_reports` 表中"已存在"的周报，纯数据模式下无意义）。
- **删除旧端点**：`/generate`、`/<report_id>` GET/PUT、`/<report_id>/export`、`/test-code-loading`（前端已不调用）。
- **删除旧脚本**：`aggregate_weekly_data.py`、`weekly_report_template.py`。
- **删除冗余 DIM 表**：`dim_vendor` / `dim_channel` / `dim_channel_category` 及 `abbreviation_mapping` 端点——简称管理页面已下线，代理商映射改从 `dim_account` 去重构建。
- **数据库底表精简至 8 张**：2 系统表（`data_import_log` / `system_configuration`）+ 6 业务表（`dim_account` / `fact_conv_content` / `fact_conv_appmarket` / `agg_vendor_daily` / `agg_xhs_note` / `agg_daily_channel_open`）。
- **校验**：API 冒烟测试 33 个接口全部通过。

### v3.2.0 已落地（2026-07-17） 报告生成页数据周报·色系与排版优化

- **堆叠图按大类色系分组**：内容平台统一红色系（8 档深浅）、应用市场统一蓝色系（8 档深浅）、本地生活绿色；同色系内按全年开户数降序分配深浅（越大越深）。
- **渠道按大类排序堆叠**：channels 按「内容平台 → 应用市场 → 本地生活」分组排序，组内按开户数降序，同色系挨在一起不交错。
- **自定义 3 大类图例**：ECharts legend 关闭（不再显示 14 个渠道名），layerHeader 右侧加 .catLegend 自定义图例（3 色块 + 文字），简洁明了。
- **标题精简**：「开户数 · 本周按日堆叠」→「开户数 · 本周」；「开户数 · 全年按周次堆叠」→「开户数 · 全年」。
- **KPI 环形图 + 占比拆本周/年度**：核心指标卡片右上角 3 个微型 SVG 环形图（开户数 / 有效户 / 资产），颜色按完成率分档；占比卡片改 3 列表格（指标 / 本周 / 全年累计）。
- **数据周报纯数据化改造**：6 指标表格化（指标 / 本周 / 全年累计 / 环比），环比中国股市色（上升红下降绿）；两堆叠图（开户数本周按日 + 全年按周次）；互联网渠道占比 section。
- **校验**：
pm run build 0 错（~42s）；POST /api/v1/reports/weekly/data W28 14 渠道、全年合计 8556 一致。

### v3.1.x 历史版本摘要

- **v3.1.36**：报告生成页堆叠图色系改造（内容红 / 应用蓝 / 本地绿）
- **v3.1.35**：报告生成页 KPI 环形图 + 占比拆本周/年度
- **v3.1.34**：报告生成页 UI 修复（Notes 移底、指标表换行、堆叠图 3 大类、刊头分隔线）
- **v3.1.33**：数据周报线索数拆企微数 + APP激活数；堆叠图改全年按周次
- **v3.1.32**：报告生成页数据周报按业务维度重梳
- **v3.1.31**：员工转化周报加存量线索新开户榜；报告生成页改造纯数据周报
- **v3.1.30**：周报海报 0 字节修复 + 日期范围选择器
- **v3.1.29**：员工转化分析卡片口径修正
- **v3.1.28**：员工转化周报海报模式进页面自动生成
- **v3.1.27**：内容平台口径显式化 + 主播引流走势图
- **v3.1.25**：开发服务器一键启停脚本（start-dev.bat / stop-dev.bat）
- **v3.1.23**：转化漏斗报表优化（左右等高 + 阶段明细表 + log 尺度）
- **v3.1.22**：涨跌颜色统一为中国股市惯例（上升红 / 下降绿）
- **v3.1.21**：Dashboard 12 张指标卡 wow_changes 修复
- **v3.1.20**：应用市场设备明细 43 字段 + bool 列修复
- **v3.1.17**：HelpModal 资源修复 + 一键 GitHub 自更新
- **v3.1.16**：菜单清理（删除简称管理）+ 线索明细扁平化
- **v3.1.14**：筛选归零修复 + 漏斗 TDZ 修复
- **v3.1.12**：代理商简称映射全链路
- **v3.1.10**：ECharts 调色板统一 + 全局日期筛选器默认值 2026 全年
