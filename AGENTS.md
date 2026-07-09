# 角色与项目背景

本项目（省心投 BI）的产品经理，聚焦券商财富管理 + AI 方向的数据产品研发，负责需求与产品规划把关。本地开发环境 Windows，工作目录 D:/AIproject/省心投BI。

> 注：个人自媒体运营、写作风格等与本仓库开发无关的信息不在此文档中保留。

--- project-doc ---

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概况

省心投 BI — 互联网广告投放数据分析平台。Python Flask 后端 + React 19/TypeScript/Vite 前端。
支持腾讯/抖音/小红书广告 + 后端转化数据的多维聚合分析。

> 注意：仓库目录名是「省心投BI」，但历史文档/包内仍混用旧名 `shengxintou`（如数据库文件 `database/shengxintou.db`、模块 `shengxintou-platform`）。

## 项目方向（重要）

**战略方向：只做数据存储 + 可视化呈现，不再做数据 mapping / 清洗 / 归一化。** 所有原始数据的清洗、规范化、字段补全、漏斗预计算都假设由上游 ETL 完成，下游只负责原样入库 + 查询 + 展示。

**当前阶段（2026-07-09）：v3.1 报表重梳已落地**
- v2 库表重构（9 张新表 + 13 查询端点改写 + 前端字段适配）✅ 完成
- 清理 v1 旧 ORM / v1 处理器 / 旧 SQLite 表 ✅ 完成
- v3.1 报表重梳（菜单重构 + 全渠道/应用市场/直播新页面 + 双漏斗 + 员工转化双源 + 数据新鲜度）✅ 完成

含义：
- 不再写做 mapping/归一化/补字段的 processor；新数据类型走 v2 原样导入
- v2 入口：`backend/processors/v2/raw_import.py`
- 旧上传识别名（tencent_ads / douyin_ads / xiaohongshu_ads / backend_conversion / xhs_notes_list / xhs_notes_daily / xhs_notes_content_daily）已返回 410 Gone，不要复活
- v3.1 新增报表（reports/omni-channel、reports/app-market/*）必须仅查 v2 新表，禁止混查 fact_conv_* / agg_vendor_daily（独立数据源）

---

## 开发命令

### 后端（Python）

```bash
# 安装依赖（项目根）
pip install -r requirements.txt

# 开发模式启动（标准 Flask，5000 端口）
DEV_MODE=1 python app.py

# 桌面模式启动（pywebview 嵌入式窗口，pyinstaller 打包版本使用）
python app.py

# 重置数据库（删除后重启会自动 db.create_all()）
# 也可以一行创建：python -c "from backend.database import db; from app import app;
#   app.app_context().push(); db.create_all()"
```

### 前端（frontend-react/）

```bash
cd frontend-react
npm install
npm run dev          # Vite dev server :3000，自动代理 /api -> 127.0.0.1:5000
npm run build        # tsc 类型检查 + vite build，产物到 dist/
npm run lint         # ESLint flat config (eslint.config.js)
npm run preview      # 预览构建产物

# 生成 API 类型（基于 openapi.yaml + orval）
npm run generate:api
# 注意：orval 会覆盖 src/types/api.ts，不要手改

# 端到端测试（Playwright，会自动启动 dev server）
npm run test
npm run test:headed
npm run test:report  # 打开 HTML 报告
```

### 一次性构建产物

后端 Flask 把 `frontend-react/dist/` 当模板 + 静态目录托管（见 `app.py`），所以前端构建后无需重启 Flask，刷新页面即可。但 React Router 兜底路由需要 dist 内的 `index.html` 存在。

---

## 关键架构

### 后端分层（M / Q / V — 见 docs/库表重构设计_v3.md）

```
backend/
├── models.py          # 系统表 ORM（DataImportLog / SystemConfiguration / WeeklyReport）
├── models_v2.py       # ✅ 新表 ORM（9 张 DIM/DWD/DWS，列名 1:1 含中文）
├── database.py        # 单例 SQLAlchemy(db)，避免循环导入
├── __init__.py        # 启动时 import models_v2 注册到 metadata
├── processors/
│   └── v2/raw_import.py   # ✅ v2 原样导入（pandas to_sql replace，无业务计算）
├── routes/
│   ├── upload.py      # v2 上传入口，仅识别 6 个新数据类型，旧类型返回 410 Gone
│   ├── metadata.py    # 元数据 + 数据新鲜度（5 张新表）
│   ├── version.py
│   ├── webdav_backup.py # 备份到坚果云 WebDAV
│   ├── weekly_reports.py
│   ├── data/            # 14 个查询蓝图（v3.1 全部查新表）
│   │   ├── cost_analysis.py          # /conversion-funnel + /conversion-funnel/split
│   │   ├── employee_conversion.py    # /employee-conversion/* (analysis/weekly/employees/filter-options/analysis-channel-overview)
│   │   ├── agency_analysis.py
│   │   ├── dashboard.py
│   │   ├── leads.py
│   │   ├── query.py / trend.py
│   │   ├── xhs_notes.py / xhs_operation.py
│   │   ├── weekly_report_poster.py / external_analysis.py
│   │   ├── account_mapping.py / abbreviation_mapping.py
│   │   └── employee_conversion_helpers.py
│   └── reports/         # v3.1 新增：reports 蓝图
│       ├── omni_channel.py  # /reports/omni-channel/{summary,daily-trend,by-channel,filter-options}
│       └── app_market.py    # /reports/app-market/{summary,funnel,detail,filter-options,creative}
│   │   ├── cost_analysis.py          # /conversion-funnel + /conversion-funnel/split
│   │   ├── employee_conversion.py    # /employee-conversion/* (analysis/weekly/employees/filter-options/analysis-channel-overview)
│   │   ├── agency_analysis.py
│   │   ├── dashboard.py
│   │   ├── leads.py
│   │   ├── query.py / trend.py
│   │   ├── xhs_notes.py / xhs_operation.py
│   │   ├── weekly_report_poster.py / external_analysis.py
│   │   ├── account_mapping.py / abbreviation_mapping.py
│   │   └── employee_conversion_helpers.py
│   └── reports/         # v3.1 新增：reports 蓝图
│       ├── omni_channel.py  # /reports/omni-channel/{summary,daily-trend,by-channel,filter-options}
│       └── app_market.py    # /reports/app-market/{summary,funnel,detail,filter-options,creative}
├── utils/decorators.py  # @handle_exceptions 等装饰器
```

**v2 重构（已落地，2026-07）**：
- **6 个新数据类型**（v2 上传识别）→ `dim_account` / `dim_vendor` / `fact_conv_content` / `fact_conv_appmarket` / `agg_vendor_daily` / `agg_xhs_note` / `agg_daily_channel_open`
- **7 个旧数据类型** 退役（`tencent_ads` / `douyin_ads` / `xiaohongshu_ads` / `backend_conversion` / `xhs_notes_list` / `xhs_notes_daily` / `xhs_notes_content_daily`），旧上传返回 410
- 13 个查询端点路径零变动，内部从旧表改为查询新表，前端零改动

**v3.1 报表重梳（已完成，2026-07-09）**：
- 顶级菜单重构：全渠道获客 / 互联网渠道数据概览 / 转化漏斗 / 线索明细 / 厂商分析 / 小红书 / 应用市场 / 员工转化 / 直播获客 / 报告生成 / 系统配置
- 双漏斗：`POST /conversion-funnel/split` 返回 content（7 阶段 fact_conv_content） + appmarket（8 阶段 fact_conv_appmarket）
- 员工转化双源：detail（fact_conv_content）+ analysis-channel-overview（agg_daily_channel_open，独立口径）
- 应用市场 4 子页：/app-market/{funnel,comparison,detail,creative}（拆自原 AppMarket/index.tsx 3 Tab）
- 直播占位：/live/funnel（v3.2 接入规范文档）
- 数据新鲜度：`/data-freshness` 返回 5 张新表（vendor_daily / xhs_note / fact_conv_content / fact_conv_appmarket / agg_daily_channel_open）
- 旧路径 redirect：/reports/app-market → /app-market/funnel；/reports/omni-channel → /omni-channel

### 路由前缀

`API_PREFIX = /api/v1`（见 `config.py`），但部分蓝图用硬编码：`/api/v1/feishu`、`/api/v1/webdav`、`/api/v1/version`、`/api/v1/xhs-note-info`。v3.1 新增 `reports/` 蓝图：`/api/v1/reports/omni-channel/*` + `/api/v1/reports/app-market/*`。

### WSGI 中间件
`app.py` 中 `DoubleApiRewriteMiddleware` 把 `/api/api/...` 重写为 `/api/...`，兼容旧版 JS 缓存的重复前缀 bug。

### React Router SPA 兜底
`@app.before_request serve_react_app` 在路由匹配失败时返回 `index.html`，让前端路由接管；Flask 还显式提供 `/js/`、`/libs/`、`/assets/`、`/icons/` 静态目录。

### 前端结构（frontend-react/src/）

```
pages/         # 顶级页面
                # Dashboard / OmniChannel / ConversionFunnel / LeadsDetail / AgencyAnalysis
                # XhsNotes/{List,Operation} / EmployeeConversion/{Analysis,Weekly}
                # Reports/AppMarket/{Funnel,Comparison,Detail,Creative} / Reports/OmniChannel
                # Live/Funnel (占位) / ReportGeneration
                # System/{DataImport,AccountManagement,AbbreviationManagement,DatabaseBackup}
components/    # Chart / DataFreshness / Filter / GuideModal / HelpModal / Icon
stores/        # zustand: useAppStore, useFilterStore（筛选条件全局状态）
services/      # http.ts (HttpClient + 拦截器) / dataService / metadataService / uploadService
                # orvalMutator.ts（orval 生成的 fetcher 自定义实现）
types/         # api.ts（orval 生成，勿手改）/ api.schemas.ts / index.ts
router/        # createBrowserRouter 配置（含旧路径 redirect：/reports/app-market → /app-market/funnel，/reports/omni-channel → /omni-channel）
layouts/MainLayout.tsx
styles/        # SCSS，variables.scss + global.scss
```

### 数据库

- 默认 SQLite：`database/shengxintou.db`（路径可由 `DATABASE_PATH` env 覆盖）
- 启动时 `app.configure_sqlite_optimization()` 设置 PRAGMA（cache_size 100MB、synchronous=NORMAL、temp_store=MEMORY、busy_timeout=5s）；注意使用传统模式 journal_mode=DELETE（非 WAL），避免便携版数据库损坏
- `config.py` 同时定义 `FEISHU_TABLE_IDS`（数据库表 → 飞书 bitable ID 映射）和 `WEBDAV_*`（坚果云备份）配置

### 飞书 / WebDAV 集成

- `feishu_sync.py` 通过 `FEISHU_TABLE_IDS` 做双向同步；启用开关 `FEISHU_ENABLED`
- `webdav_backup.py` 用 `webdavclient3` 推送到坚果云，保留最近 `WEBDAV_MAX_BACKUPS` 个（默认 3），支持压缩 `WEBDAV_USE_COMPRESSION`

---

## 数据导入流程（v2）

上传文件 → `POST /api/v1/upload` → `backend.routes.upload` 异步线程：

1. 创建 `DataImportLog` 记录（status/progress/inserted_rows/...）
2. 调用 `backend.processors.v2.raw_import.write_to_db(data_type, filepath)`
3. v2 原样导入：`pandas.read_excel` → 规范化（`nan`→NULL、时间解析、超长 ID 转字符串、`是/否`→0/1）→ `pandas.to_sql(if_exists='replace')`
4. 更新 `DataImportLog` 完成

> **关键**：v2 不算漏斗、不算转化率、不补映射 — 这一切都在 ETL 上游完成。下游查询只做 SELECT + 聚合。

---

## 配置

复制 `.env.example` 为 `.env`（已 gitignored）。重要变量：
- `DATABASE_PATH`、`HOST`、`PORT`(5000)、`DEBUG`、`DEV_MODE`
- `FEISHU_APP_ID/SECRET/BITABLE_ID`、`FEISHU_ENABLED`
- `WEBDAV_URL/USERNAME/PASSWORD/BASE_PATH/MAX_BACKUPS/USE_COMPRESSION`
- `MAX_CONTENT_LENGTH`(MB)、`ALLOWED_EXTENSIONS`、`UPLOAD_FOLDER`、`LOG_FOLDER`、`LOG_LEVEL`

数据库/上传/日志目录若不存在会在启动时自动创建。

---

## 注意事项 / 踩坑记录

- **不要动 `data.py.backup_20260211_174355`**：v0.9.1 拆分前的 4000 行单文件备份，仅留作对照
- **`models_v2.py` 列名含中文**（如 `AggVendorDaily.花费`、`FactConvContent.微信昵称`），SQLAlchemy 用 `Text`/`BigInteger`/`Float`，**禁止改列名以匹配业务字段**（会影响 `pd.to_sql` 落库）
- **`POST /api/v1/conversion-funnel` 拆两套漏斗**：内容平台走 `fact_conv_content`，应用市场走 `fact_conv_appmarket`，响应带 `channel_category` 字段（见 `cost_analysis.py`）
- **`POST /api/v1/employee-conversion/analysis`** 顶部核心指标不过滤，从 `agg_daily_channel_open` + `agg_vendor_daily` 平台概览计算（v1.0 修复：旧版会被筛选过滤掉）

- **`POST /api/v1/conversion-funnel/split`**：双漏斗端点。内容平台走 `fact_conv_content`（7 阶段），应用市场走 `fact_conv_appmarket`（8 阶段），响应带 `channel_category` 字段。`/conversion-funnel` 旧端点保留 1 个 release 加 deprecation，v2.2 删除
- **`POST /api/v1/employee-conversion/analysis-channel-overview`**：员工渠道概览，数据源 `agg_daily_channel_open`，**与 detail 端点是独立口径**（按用户口径与明细解耦），数字不一致是**预期**的，前端必须明确标注口径来源
- **`POST /api/v1/reports/omni-channel/*`**：单一独立数据源 `agg_daily_channel_open`，**禁止混合** fact_conv_* / agg_vendor_daily。占比由前端按响应数据实时算
- **`POST /api/v1/reports/app-market/*`**：数据源 `fact_conv_appmarket`（明细）+ `agg_vendor_daily`（创意），双源。creative 端点是客户端聚合
- **`/api/v1/data-freshness`**：返回 5 张新表数据状态。`critical`（>14 天）/ `warning`（>5 天）/ `normal`（≤5 天）
- **打包**：`省心投启动器.exe`（gitignored，7.7MB，PyInstaller 产物）+ `python-3.9-embed/` + `lib/` 便携版结构；dev 环境双击 exe 自动 fallback 到 `.venv/Scripts/python.exe`
- **orval**：不要手改 `src/types/api.ts`，必须通过 `npm run generate:api` 重新生成
- **数据源**：v2 上传识别 6 个新类型（account_mapping / conversion_content / conversion_appmarket / vendor_daily / xhs_note / channel_open）→ 旧 7 个类型 → 410 Gone
- **bizModel 推断**：`backend_conversions` 的 `business_model` 用 `customer_source` 推断（旧 bug：曾用 `traffic_type` 推断错误）
- **代理商分析小计/合计行**：`agency_analysis.py` 响应里带 `is_subtotal`/`is_total` 字段，前端展示指标卡片需跳过
- **打包**：`省心投启动器.exe` + `python-3.9-embed/` + `lib/` 便携版结构（gitignored）；构建脚本排除旧启动器、旧前端 `frontend/`、测试脚本（详见 `version.json`）
- **Swagger**：`/apidocs` 可选（需装 flasgger，未列在 requirements.txt），app.py 已做 ImportError 容错

---

## 文档

- `README.md` — 用户视角介绍、平台特性、技术栈
- `docs/v3.1_报表重梳方案.md` — v3.1 报表重梳（菜单/双漏斗/双源/4 子页/直播占位）
- `docs/库表重构设计_v2.md` — v2 设计基线（DIM/DWD/DWS 分层）
- `docs/库表重构设计_v3.md` — v3 实施收尾对账
- `docs/前端全栈改造清单.md` — React 迁移要点
- `docs/数据库架构文档.md` — 旧 13 表字段说明（v1.2.0；新表 v2 见重构设计）
- `docs/部署指南.md` — 开发/生产/Docker/性能优化/监控/故障排查
- `docs/uploads_cleanup_guide.md` — uploads 目录清理指引
- `docs/REFACTOR_REPORT_legacy.md` / `USAGE_GUIDE_legacy.md` / `VALIDATION_GUIDE_legacy.md` — 历史文档归档

---

## 版本

当前 `version.json`：`1.0.0`（2026-03-20）— 前端架构迁移至 React 19 + TS + Vite 完成。
README 标注 v0.9.1（2026-02-13）— 后端 data.py 拆分为 18 个模块。
中间经历 v2 库表重构（9 张新表 + 13 端点改写）。