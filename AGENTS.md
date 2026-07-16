# 省心投 BI 项目文档（AGENTS / CLAUDE）

> 本文件是仓库根目录的项目工作说明。`AGENTS.md` 与 `CLAUDE.md` 应保持同一内容；修改其中一份时必须同步另一份。
> 本地工作目录：`D:/AIproject/省心投BI`，默认环境：Windows + PowerShell。

## 1. 项目概况

省心投 BI 是券商财富管理场景下的互联网广告投放 + 开户转化数据分析平台，定位是「数据存储 + 查询聚合 + 可视化呈现」。原始数据的 mapping / 清洗 / 归一化 / 漏斗预计算由上游 ETL 完成，下游只做原样入库 + SELECT 聚合 + 报表展示。

- 后端：Python Flask + SQLAlchemy + SQLite + pandas 原样导入（`to_sql(replace)`）。
- 前端：React 19 + TypeScript + Vite + Ant Design 5/6 + @ant-design/plots / @ant-design/charts + ECharts + Zustand。
- 当前版本基线：`version.json` 为 `3.1.23`（2026-07-16）。下一站 `v3.1.24`（待规划：webdav 5xx 长尾专项排查 + 账号管理迭代）。

### v3.1.11 已落地（2026-07-15）

### v3.1.12 已落地（2026-07-15）

- **代理商简称映射全链路（简称优先）**：新增 ackend/utils/agency_mapper.py 提供 get_all_shorts() / short_to_full() / ull_to_short() / enrich_items() / expand_short_to_fulls()；metadata 端点 agencies 改从 DimVendor.agency_short（简称）查询，返回 {value, label, full_names} object format；gency_full_map 透传前端用于标签提示。

- **所有后端 .厂商/广告代理商 in_ 筛选展开简称→全称**：gency_analysis.py / cost_analysis.py / dashboard.py / external_analysis.py / leads.py /     rend.py 共 6 个文件 .in_() 前调用 expand_short_to_fulls()，支持前端选简称匹配后端全称记录。

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
  
  ### v3.1.13 已落地（2026-07-15）

- 新增 \ackend/utils/agency_mapper.py\：get_all_shorts / short_to_full / full_to_short / enrich_items / expand_short_to_fulls / reset_cache

- 6 个后端路由文件 .厂商/.广告代理商 in_ 筛选前调用 expand_short_to_fulls()

- metadata 端点 agencies 改从 DimVendor.agency_short（简称）查询，返回 {value, label, full_names}[] object 格式

- abbreviation_mapping CRUD 后调用 reset_cache() 使缓存即时刷新

- frontend AgencyFilter + metadataService 类型同步适配新 agencies object 格式

- AgencyAnalysis 表格 dataIndex 从 agency 改为 agency_short，CSV 导出兜底

- OmniChannel 4 卡标题恢复短标题

- npm run build 0 error → dist 刷新 → 5000 端口同步

### v3.1.14 已落地（2026-07-15）

- **修复筛选归零**：6 个后端路由文件移除 expand_short_to_fulls() wrapper。根因：agg_vendor_daily.厂商 和 fact_conv_content.广告代理商 存的是简称（如 '量子'），expand_short_to_fulls('量子') 展开为 ['申万宏源-量子']，WHERE IN 匹配 0 行导致所有筛选返回 0。修复后简称直接查询，API 验证 agencies=['量子'] → 3769 leads。
- **ConversionFunnel load is not defined**：const loadData 定义移到 applyFilters / resetFilters 之前，解决 TDZ（暂存死区）运行时 ReferenceError。

### v3.1.16 已落地（2026-07-15）

- **菜单清理：删除「简称管理」**：账号管理已包含 platform / agency / agency_short / business_model 全部字段，简称管理菜单冗余，移除 /system/abbreviation-management 菜单项 + pages/System/AbbreviationManagement.tsx + .module.scss + router 路由。后端 abbreviation_mapping 路由保留（DimVendor 由 ETL/导入侧维护）。
- **线索明细菜单扁平化**：MainLayout 将线索明细由 leads-detail-group 子菜单（单条 /leads-detail 子项）扁平化为顶级菜单项 key=/leads-detail。
- **npx tsc --noEmit + npm run build** 双通过。

### v3.1.23 已落地（2026-07-16）

- **转化漏斗报表优化**：
  - **左右等高布局**：内容平台 / 应用市场 两个 Tab 下的漏斗图 + 阶段转化详情 Card 改为 `<Row align="stretch">` + `<Col span={12}>`，通过 `.funnelSplitRow / .funnelSplitCol / .h100Card` 三个 scss 类拉伸高度。
  - **8×4 阶段明细表**：原 .stageList / .stageItem 简易渲染改为真 HTML `<table>`（table-layout: fixed）：表头 # / 阶段 / 累计人数 / 累计转化率 4 列；行高 hover 反色；数字列右对齐 + tabular-nums。
  - **FunnelChart 新增 `useLogScale` 对数尺度**：传入后调用 `Math.log10(count + 1)` 映射缓解各级数据偏差过大（内容平台 5.86亿曝光 → 3099 有效户约 19万倍，线性下层几乎看不见）；CSS FallbackBars 也同步以 log 计算宽度；label / tooltip 始终以原始人数呈现。
  - **ReportFooter 补选中平台受限说明**：原来塑在筛选卡里的说明“当前仅针对 内容平台 / 应用市场 两套独立漏斗加载；选中平台仅受后端 现有 platforms 参数限制”移至 ReportFooter.notes，筛选卡唯留提示 + 查询 / 重置按钮。
- **校验**：Python smoke `POST /api/v1/conversion-funnel/split` 返回两套独立漏斗、content 7 阶段、appmarket 8 阶段；`npm run build` 0 error；`npx tsc --noEmit` 0 error。

### v3.1.22 已落地（2026-07-16）

- **跌涨颜色统一为中国股市惯例**（上升=红 / 下降=绿）：以前 v3.1.21 采用西方习惯（上升=绿下降=红），与中国股市及多数业务场景反转。调整后全竟指标均随方向上色。
  - **后端**：dashboard.py `_w()` 函数去掉 inverse 参数与所有 inverse=True 调用；color 始终 = 'red' if is_up else 'green'。
  - **前端 MetricCard**（全局 + Dashboard 本地两份） + **WowChangeIndicator**：getTrendColor 去掉 inverseTrend 反转分支，直接 color === 'green' → success / color === 'red' → error。
  - **Dashboard/index.tsx**：3 个成本卡移除 inverseTrend 属性。
  - **接口兼容**：inverseTrend prop 保留但逻辑废弃，避免外部 break。
- **校验**：Python smoke 近 7 天区间、2026-07-10 ~ 2026-07-16、所有 12 个指标卡均走中国惯例颜色（down 的指标均绿，cost_per_* 上升也是红）。`npm run build` 0 error。

### v3.1.21 已落地（2026-07-16）

- **Dashboard 数据概览 12 张指标卡 wow_changes 修复**（后端）：
  - **补齐 6 个缺失环比字段**：`prev_q` 拓展加上 impressions / clicks / existing_assets；wow 补 `total_impressions` / `total_clicks` / `existing_customers_assets` / `cost_per_lead` / `cost_per_account` / `cost_per_valid_account`（6 字段与前端 MetricCard 读取对齐）。cost_per_* 由分母 cost / 分母 leads/opened/valid 当期与上期各算后再比（inverse上升红下降绿）。
  - **`_w()` 辅助函数**：trade 跟 curr/prev 大小走（up/down），color 随 trade 反转（默认上升绿下降红；inverse参数用于 cost 类，上升红下降绿）。修复前后端 `color: 'green'` 硬编码导致箭头翻转颜色不变的 bug。
- **校验**：Python smoke `POST /api/v1/dashboard/core-metrics`（2026-01-01 ~ 2026-12-31）返回 12 字段；investment +113.5% up red、total_leads +27.84% up green、customer_contribution -29.86% down red、cost_per_lead +67.01% up red、cost_per_account -46.87% down green、全部随 trend/color 正确。`npm run build` 0 error。

### v3.1.20 已落地（2026-07-16）

- **应用市场设备明细（AppMarket/Detail）与线索明细同步**：两个表都是原样呈现底表源表（fact_conv_appmarket / fact_conv_content）。
  - **后端 `app_market_detail` 从 16 字段扩充为 43 字段**：与 `models_v2.FactConvAppmarket` 1:1，表格列（下载日期 / 应用市场 / 应用市场名称 / 渠道类型 / 设备号 / 资金账号 / 激活APP / 开户成功 / 新开户 / 入金 / 有效户）保留短名 bool；详情浮7e7a5c5f33字段以源表中文列名完整返回（含数据更新日期 / 投放账号 / 广告计划ID / 注册手机号 / 是否注册身份证 / 注册身份证时间 / 是否注册银行卡 / 注册银行卡时间 / 是否激活APP / APP激活时间 / 是否开户注册 / 注册开户流程时间 / 是否提交开户 / 提交开户时间 / 是否开户成功 / 开户成功时间 / 开户时间 / 是否新开户 / 是否创建完资金账号 / 资金账号创建完成时间 / 是否入金 / 是否有效户 / 有效户时间 / 是否存量客户 / 总资产 / 累计创收 / 人均日创收）。
  - **5 个 bool 列加 `dataIndex` + `key`**：原代码 `render: (v: any) => v ? ...` 没设 dataIndex，antd 把整行 record 当 v 传入（对象永远 truthy → 全"是"）。现在表格 5 个 bool 列均设 `dataIndex: '激活APP'` 等 + 统一 `renderBool`。
  - **详情浮7e7a5c5f33 Descriptions（column=2）**：与 LeadsDetail 同款、`width=800` + `.detailModal` label 加宽 110px。
  - **过滤/表格/模态三段样式对齐 LeadsDetail**：`filterRow / filterGroup / filterLabel / filterActions` + `tableCard / tableHeader / tableTitle / statText`；`.page` padding 16 -> 0（v3.1.19 同款修复）。
- **校验**：`npm run build` 0 error（5988 modules）→ dist 刷新→ 5000 端口可访问；Python smoke `POST /api/v1/reports/app-market/detail` 返回 43 字段、bool 为 true/false、总行数 137,516。

### v3.1.17 已落地（2026-07-15）

- **HelpModal 资源修复**：`logo-hengban-C.png` → `public/icons/logo-横版.png`（实际文件存在）；`陈元晗肖像.svg` → `public/icons/陈元昊肖像.svg`；创建者姓名 2 处 `陈元晗` → `陈元昊`；tooltip typo `发珠投 BI` → `省心投 BI`；scss 类名 `创建者Avatar` / `创建者Info` → `creatorAvatar` / `creatorInfo`。
- **HelpModal 一键 GitHub 自更新（v3.1.17 新能力）**：版本信息卡下方新增「从 GitHub 更新代码」按钮（脏工作区时显示「强制更新（stash 本地改动）」）。点击后调起后端 `git pull origin main`，实时显示进度条 / 阶段描述 / 日志；dirty 时自动用 `git stash push -u` 暂存。
- **后端自更新 API**（`backend/routes/system/self_update.py` + `__init__.py`，蓝图 `/api/v1/system`）：3 端点 `GET /self-update/git-status`（读 HEAD/dirty/remote）、`POST /self-update/start`（后台线程跑 `git fetch + reset --hard` + 装 `version.json`，返回 task_id）、`GET /self-update/status?task_id=...`（1s 轮询）。`_read_version_json()` 纯函数，**后台线程不依赖 Flask current_app**（`app.py` 用 `app.register_blueprint(system.bp)`）。
- **前端 dataService 扩 3 方法**：`dataService.getGitStatus()` / `selfUpdateStart(force)` / `selfUpdateStatus(taskId)`。
- **HelpModal UI 集成**：`useEffect` 自动加载 `gitStatus` + 启动后 `setInterval(1000ms)` 轮询状态；Progress + 阶段描述 + 日志面板；结果区展示 `before_version → after_version`，失败弹错误信息。
- **一次性脚本不进 git**：本次自更新实现保留了 `scripts/_fix_*.py` / `_patch_*.py` / `_poll_test.py` / `_sync_docs.py` 帮助脚本（`.gitignore` 已排除 `scripts/`，不要 commit）；README/AGENTS § 8 已有「一次性脚本不进 git」约定。
- **校验**：`npx tsc --noEmit` 0 错；`npm run build` 0 错（5988 modules）。

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

- **不要动 `data.py.backup_20260211_174355`**
- **后端详情接口与前端浮7e7a5c5f33字段对齐**：修改详情浮7e7a5c5f33前一定检查后端返回的字段集是否覆盖所有 Descriptions.Item 的 label；不覆盖则部分字段显示"-"。AppMarket/Detail 原只返 16 字段，前端浮7e7a5c5f33 33 字段，v3.1.20 后端扩为 43 字段与源表 1:1。

：v0.9.1 拆分前的 4000 行单文件备份，仅留作对照。
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

- **antd `Table` columns 缺 `dataIndex`**：列未设 dataIndex 时 `render(v)` 拿到的 `v` 是整行 record，对象恒 truthy → 全部返回"是"（AppMarket/Detail 5 个 bool 列出现过此 bug，v3.1.20 修复）。
- **Flask 后台线程不能用 `current_app`**：自更新 `self_update.py` 的后台 `_do_self_update(task_id, force)` 跑在子线程，**Flask app context 不会自动继承**。要拿 `version` / `current_app.config` 时必须 `with app.app_context():`，否则抛 `RuntimeError: Working outside of application context`。当前实现已用纯函数 `_read_version_json()` / `_run_git()` 绕开，避免引入 context 依赖。
- **`git pull` 前检测 dirty 工作区**：未 commit 的本地改动会让 `git pull` 直接报 `Your local changes would be overwritten` 失败；前端调 `start(force=true)` 时后端先 `git stash push -u -m self-update-<ts>` 暂存再 pull，更新成功后用 `git stash pop` 恢复（冲突时报错并保留 stash 供用户手动处理）。
- **Windows `subprocess.run` 弹 cmd 黑窗**：默认 `creationflags=0` 会从父进程继承 console，每次 git 调用（`rev-parse / status / fetch / pull`）都会闪一个黑窗口，用户体验极差。**修复**：`_run_git` 显式传 `creationflags=0x08000000`（CREATE_NO_WINDOW），子进程静默执行、stdout/stderr 仍走 `capture_output=True` 收集。其它 Windows 子进程调用（备份、git hook、第三方 SDK）也按同样方式处理。
- **报表 `.page` padding 全站统一为 0**（v3.1.19 fix）：早期 OmniChannel `index.module.scss` 用了 `padding: var(--spacer-16)` 让整页内容向右下偏移 16px，与 Dashboard / ConversionFunnel / AnchorCluster / Live/Funnel / AgencyAnalysis / LeadsDetail 等 padding:0 的页面不齐。后续新建 / 修改报表 `.page` 时禁止再加 padding，外层由 MainLayout / ConfigProvider 提供统一间距。

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

