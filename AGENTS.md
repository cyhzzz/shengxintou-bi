# 省心投 BI 项目文档（AGENTS / CLAUDE）

> 本文件是仓库根目录的项目工作说明。`AGENTS.md` 与 `CLAUDE.md` 应保持同一内容；修改其中一份时必须同步另一份。
> 本地工作目录：`D:/AIproject/省心投BI`，默认环境：Windows + PowerShell。当前日期 2026-07-14。

## 1. 项目概况

省心投 BI 是券商财富管理场景下的互联网广告投放 + 开户转化数据分析平台，定位是「数据存储 + 查询聚合 + 可视化呈现」。原始数据的 mapping / 清洗 / 归一化 / 漏斗预计算由上游 ETL 完成，下游只做原样入库 + SELECT 聚合 + 报表展示。

- 后端：Python Flask + SQLAlchemy + SQLite + pandas 原样导入（`to_sql(replace)`）。
- 前端：React 19 + TypeScript + Vite + Ant Design 5/6 + @ant-design/plots / @ant-design/charts + ECharts + Zustand。
- 当前版本基线：`version.json` 为 `3.1.6`（2026-07-15）。下一站 `v3.1.7`（计划：OmniChannel「TOP 合作机构」长尾排名；WebDAV 长尾已闭环为用户本机网络/VPN 问题）。
- 历史命名：仓库目录是「省心投 BI」，但数据库文件 `database/shengxintou.db`、模块名 `shengxintou-platform` 仍沿用旧名，禁止为了"统一命名"随意改路径或表名。

## 2. 产品与数据方向（重要）

战略方向：**只做数据存储 + 查询聚合 + 可视化呈现，不在本项目继续做业务 mapping / 清洗 / 归一化 / 字段补全。**

落地含义：

- 上游 ETL 负责业务清洗、规范化、字段补全、漏斗预计算与口径修正。
- 后端导入只做文件读取、空值处理、日期/布尔/ID 的格式层安全处理，外加 `pandas.to_sql(if_exists='replace')` 原样落库。
- 查询端点可以做 SELECT、SUM、GROUP BY、分页和兼容派生字段，不要新增下游业务口径修补逻辑。
- 新数据类型必须走 v2 原样导入入口：`backend/processors/v2/raw_import.py`。
- 旧 v1 上传类型已退役并返回 410 Gone，不要复活旧 processor 或旧表链路。

## 3. 当前版本状态（2026-07-14，v3.1.3 已落地）

| 版本 | 日期 | 主题 |
|---|---|---|
| v2.x | 已落地 | 库表重构：9 张 DIM/DWD/DWS 新表 + 13 个查询端点改查新表 |
| v3.1 | 已落地 | 报表重梳：菜单重构、双漏斗、应用市场 4 子页、员工转化双源、直播占位、数据新鲜度 |
| v3.1.1 | 2026-07-10 | 前端 UI 统一化：抽出 `MetricCard` / `MetricSection` / `ReportFooter`，设计 token、日/夜主题、所有报表头部数据卡片统一调用 |
| v3.1.2 | 2026-07-13 已落地 | 报表样式收敛：漏斗图切 @ant-design/plots；OmniChannel 第 4 卡修复；Live/Funnel + 主播聚类乱码清洗；EmployeeConversion 迁新 MetricCard；数据源下沉 ReportFooter |
| v3.1.3 | 2026-07-14 已落地 | 8 项 UI / 报表收口（同上） |
| **v3.1.4** | **2026-07-14 已落地** | **6 项需求响应：OmniChannel #4 升级 + KPI 完成率；转化漏斗筛选器；小红书 desc 排序；主播分析总资产修正；6 个 v2 指南补省心投平台导出位置；Dashboard 加蓝色日历热力图 + 后端 daily-calendar 端点** | | **8 项 UI / 报表收口：OmniChannel 第 4 卡换互联网渠道开户数 + KPI 完成率；Dashboard 移除数据状态卡；侧栏菜单支持滚动；AppMarket/Detail 设备明细详情浮窗；主播聚类改主播分析 + 同名聚合 + 平台/主播筛选 + 一页呈现；DataImport 上下布局 + 卡片缩小 + 6 个新指南映射 + 404 兜底；DatabaseBackup 错误信息精细化；小红书笔记筛选器修复（object[] 不再触发 antd in 报错）** |

### v3.1.1 已落地清单

- 抽出公共 `MetricCard` + `MetricSection` 组件（`frontend-react/src/components/MetricCard/`）。
- 抽出 `ReportFooter` 组件（`frontend-react/src/components/ReportFooter/`）作为报表页底部弱化区，集中展示「数据源 / 端点 / 口径说明」。
- 抽出 `FunnelChart`（基于 antd Card + CSS 自渲染横条漏斗）作为 v3.1.1 临时方案。
- 引入 design token 体系 `styles/tokens.css`（品牌色 / 间距 / 圆角 / 阴影 / 字体 / 功能色 / 图表色板，日夜间变量）与共享 mixin `styles/mixins.scss`。
- 接入日/夜主题：`<html data-theme="dark">` + `useAppStore.themeMode` + Ant Design `ConfigProvider` 动态算法 + Header 切换入口。
- 报表头部 4 KPI 卡片统一为 `MetricSection + MetricCard` 4/3/2/1 响应式，与 Dashboard（互联网渠道数据概览）一致。
- 清理 `MainLayout` 中 7 处 `!important` 与 14 处 `:global()` 覆盖，统一 Menu 选中色为品牌色。
- Dashboard 重复的 `Card+Row/Col` 卡片组收敛，全部走 `MetricSection`。

### v3.1.2 已落地清单（2026-07-13）

- **漏斗图改造**：`FunnelChart` 切换为 `@ant-design/plots` 的 `Funnel`（用户明确期望的「antd 合适的漏斗图组件」），CSS 横条漏斗仅作 `ErrorBoundary` 降级；标签加 `人` 单位 + 阶段转化率 `Tag`。
- **漏斗图布局统一**：`ConversionFunnel` / `Live/Funnel` / `Reports/AppMarket/Funnel` 三处漏斗图 `Col span` 从 14/10 改为 24，整行展示，避免出界。
- **全渠道获客概览顶部第 4 张卡修复**：title 由静态 `TOP 渠道类别占比` 改为动态 `TOP 渠道类别开户人数（合作机构）`，value 改绝对开户人数，description 展示占比 + 分子分母，语义一眼可读。
- **直播漏斗 / 主播聚类乱码修复**：新增 `frontend-react/src/utils/sanitizeText.ts`，渲染 `platform` / `anchor` / `sources` 前清洗 NUL、控制字符、`\uFFFD`、不可见零宽字符。
- **AnchorCluster 第 1 张卡净化**：移除冗余 description（信息已下沉到 `ReportFooter` notes）。
- **EmployeeConversion/Analysis 切新 MetricCard**：顶部 4 卡 + 双源对比 5 卡共 9 张卡统一迁到新 `MetricCard + MetricSection`，双源 5 卡的 `description` 不再写数据源（fact_conv_content / agg_daily_channel_open），全部下沉到 `ReportFooter`。
- **数据源 / 端点 / 口径说明统一下沉**：所有报表页（除小红书运营 XhsNotes/Operation 与员工转化 Weekly 周报海报外）底部都用 `ReportFooter` 弱化区集中标注，MetricCard description 只保留单卡轻量上下文。
- **同步重写文档**：`AGENTS.md` / `CLAUDE.md` 字节一致更新到 v3.1.2 已落地。
- **重新构建 dist**：`npm run build`（5887 modules，0 error）→ 5000 端口已同步最新代码。
### v3.1.3 落地清单（2026-07-14）

- **OmniChannel 第 4 卡换互联网渠道开户数 + KPI 完成率**：title 改 `互联网渠道开户数`，value 改全渠道互联网开户总数 `totals.opens`，description 展示 KPI 完成率（年度 KPI：开 2 万户 / 1 万有效户，按 `elapsedRatio = dayOfYear / 366` 时间折算），第 N 天等上下文。
- **Dashboard 移除数据状态卡**：删除 `DataFreshnessIndicator` 顶部块 + import + `useNavigate` + `freshnessRef` 残留；数据状态仅在数据导入页 + 关于页面保留。
- **侧栏菜单支持滚动**：`MainLayout.module.scss` `.sider` 改 `overflow-x: hidden; overflow-y: auto; height: 100vh;`；`MainLayout.tsx` 菜单 `主播聚类` label 改 `主播分析`。
- **AppMarket/Detail 设备明细详情浮窗**：行点击 `EyeOutlined` → `Modal` + `Descriptions column={2}`，展示 `下载日期 / 应用市场 / 渠道类型 / 设备号 / 资金账号 / 激活APP / 开户成功 / 新开户 / 入金 / 有效户` + 剩余字段动态列出。
- **主播聚类改名 + 多平台聚合 + 平台/主播筛选 + 一页呈现**：菜单 label + 页面 title + 顶部 MetricSection + Card title 全改 `主播分析`；`items` 包 IIFE 客户端按 `anchor` 聚合 `platforms/leads/mouth/valid_lead/opened/valid/assets/sources`；列改造为「主播名字 / 覆盖平台 / 平台数 / 线索量 / 开口量 / 有效线索 / 开户量 / 有效户 / 开户率 / 有效率 / 总资产 / 线索来源」；filter 卡片加 `主播` Select（`showSearch`，`optionFilterProp='label'`）；`pagination={false}` 强制一页呈现。
- **DataImport 上下布局 + 卡片缩小 + 6 个新指南映射 + 404 兜底**：`index.tsx` Row/Col 左右布局 → `<Space direction='vertical'>` 上下布局 + 描述补充「数据源自省心投系统导出，二次导入分析」；`DataTypeSelector.module.scss` `minmax(160px → 140px)` + gap/padding/font-size 全部缩一档；`GuideModal` GUIDE_TITLES 增补 6 个 v2 新类型（`account_mapping / conversion_content / conversion_appmarket / vendor_daily / xhs_note / channel_open`）并保留 7 个 v1 旧类型（标 `已下线` 兜底）；`loadGuide` 增加 `content-type: text/markdown` 校验，避免后端 SPA 兜底返回 `index.html` 被 ReactMarkdown 当 md 渲染成乱码。
- **DatabaseBackup 错误信息精细化**：`loadBackupList` 透出后端 `error` code（`LIST_FAILED / UNKNOWN`），网络层异常显示 `status` 并引导用户点「测试连接」自检。
- **小红书笔记筛选器修复（v3.1.2 收口）**：`XhsNotes/List.tsx` 4 个枚举 `useState<string[]>` 改为 `{value,label}[]` object array；新增 `opts()` helper 兼容 string/object 输入；解决后端 `/xhs-notes/filter-options` 返回 object array 时 antd 对 string[] 做 `in` 检查报 "Cannot use in operator" 的崩。
- **文档 + 构建同步**：`AGENTS.md` / `CLAUDE.md` 字节一致更新到 v3.1.3 落地态；`npm run build` 0 error → 5000 端口 dist 同步最新代码（约 5887+ modules）。

### v3.1.4 落地清单（2026-07-14）

- **OmniChannel 第 4 卡升级**：title 改 `互联网渠道开户数`，value 改全渠道互联网开户总数 `totals.opens`，description 展示 KPI 完成率（年度 KPI：开 2 万户 / 有效户 1 万，按 `dayOfYear / 366` 时间折算），同时移除 TOP 渠道类别占比。
- **转化漏斗筛选器**：新增日期范围 `RangePicker` + 平台多选 `Select`（小红书 / 腾讯 / 抖音 / 快手 + 小米 / 华为 / OPPO / VIVO / 荣耀 / 苹果），apply / reset 联动双漏斗与内容平台 KPI 卡；KPI 从「客户线索」起步，删除「广告曝光」「客户点击」两张前置卡（来源 fact_conv_content / fact_conv_appmarket）。
- **小红书笔记排序升级**：后端 `/api/v1/xhs-notes/list` 接受 `sort_field` / `sort_order` 参数（白名单字段映射到 `AggXhsNote` 列，默认 `开户人数` / `desc`）；前端默认 `desc`，把 2339 行中 93 行有数笔记排到最前面（之前被 2246 行 =0 埋没）。
- **主播分析总资产修正 + 覆盖平台 Tag**：客户端聚合 `总资产` 只累加 `opened > 0` 行的 `assets`（即「仅开户创收」），列头 / CSV header 从「总资产」改「总创收资产（仅开户）」；「覆盖平台」列改用 `<Space>` + `<Tag color=cyan>` 去重展示。
- **6 个 v2 数据导入指南首行补「省心投平台导出位置」**：`account_mapping_guide / conversion_content_guide / conversion_appmarket_guide / vendor_daily_guide / xhs_note_guide / channel_open_guide` 每个文件首行加 `数据可从 省心投平台（公司内网站）X.X 名称 导出后二次导入到本 BI 进行分析`。
- **Dashboard 新增开户日历热力图**：后端 `/api/v1/reports/omni-channel/daily-calendar` 端点（`agg_daily_channel_open` 按 `渠道类别=互联网引流` + `GROUP BY 时间区间` → `[{date, opens}]`，默认 `days=365`，范围 `7..366`）；前端 `Dashboard/index.tsx` 在 `<TrendChart>` 下方插入 `<CalendarHeatmap>`，蓝色 5 档 `l0..l4` 主调（`l0=#e0efff-08 / l1=#b3d8ff / l2=#69b8ff / l3=#1f8aff / l4=#0050b3`），按周一开始排列，月份标签自动切换，hover 显示 `日期 + 互联网渠道开户数`，统计行展示 `年度总开户 / 有数据日数 / 单日最高`。
- **后端 import 整理**：`omni_channel.py` 顶部统一 `from datetime import datetime, timedelta`，移除文件末尾重复 import；`/daily-calendar` 函数前后 PEP8 双空行。
- **文档同步 + 构建**：`AGENTS.md` / `CLAUDE.md` 字节一致更新到 v3.1.4；`npm run build` 0 error（5889 modules）→ `frontend-react/dist/` 已同步到 5000 端口。

### v3.1.4 修复行动登记（2026-07-14）

| # | 优先级 | 影响面 | 任务 | 状态 |
|---|---|---|---|---|
| 1 | 高 | OmniChannel 第 4 卡 | 升级 `互联网渠道开户数` + KPI 完成率（年度 2万/1万 × 时间折算）+ 移除 TOP 合作机构占比 | v3.1.4 已落地 |
| 2 | 高 | 转化漏斗 | 新增 RangePicker + 平台 Select 筛选器 + KPI 从客户线索起步 + 删除广告曝光/客户点击卡 | v3.1.4 已落地 |
| 3 | 高 | 小红书笔记 | 后端 sort_field/sort_order 白名单 + 前端默认 `开户人数 desc` | v3.1.4 已落地 |
| 4 | 中 | 主播分析 | 总资产只累加 `opened > 0` 行的 `assets`；覆盖平台用 Tag 去重 | v3.1.4 已落地 |
| 5 | 中 | 6 个 v2 数据导入指南 | 首行补「省心投平台 X.X 名称 导出后二次导入」 | v3.1.4 已落地 |
| 6 | 中 | Dashboard 趋势图下方 | 后端 `/daily-calendar` + 前端蓝色 5 档 CalendarHeatmap 集成 | v3.1.4 已落地 |
| 7 | 低 | omni_channel.py | 末尾重复 `from datetime import` 删除 + 函数体前后双空行 | v3.1.4 已落地 |
| 8 | 低 | 数据同步报错 | `webdav/list` 500 长尾根因排查（v3.1.3 #11 未排项已转 v3.1.4 延后） | 延 v3.1.5 |
| 9 | 中 | dist 滞后 | `npm run build` 0 error → 5000 端口同步（5889 modules） | v3.1.4 已落地 |
### v3.1.5 落地清单（2026-07-15）

- **6 个 v2 数据导入指南首行精确段位替换 + 关键短句加粗**：把 v3.1.4 的通用 `数据可从 省心投平台（公司内网站）X.X 名称 导出后二次导入到本 BI 进行分析` 替换为用户给的精确指向 + 关键类型名词 `**...**` 加粗：
  - `account_mapping_guide.md` → **投放账号映射**，详见公司省心投平台 **1000.7 广告代理商映射表数据查询**。
  - `conversion_content_guide.md` → **内容平台加微链路**，详见公司省心投平台 **4 线索明细**。
  - `conversion_appmarket_guide.md` → **应用市场下载链路**，详见公司省心投平台 **8.1 应用市场归因明细**。
  - `vendor_daily_guide.md` → **厂商广告投放分析**，详见公司省心投平台 **9.2 厂商广告投放分析**。
  - `xhs_note_guide.md` → **小红书笔记**，由公司省心投平台 **6.1 小红书笔记表** 导出。
  - `channel_open_guide.md` → **开户渠道分析**，详见公司省心投平台 **0.1 开户渠道分析明细**。
- **v3.1.4 需求文档侧确认（非代码变更）**：用户报的 6 项 v3.1.3 落地后续问题中，1/2/3/4/6 已在 c250a6d (v3.1.4) 中落地，push 后实际可见；当前文件检查再次确认：
  - OmniChannel 第 4 卡已 `internetRow.opens`（后端 by_category 真按 `channel_category=互联网引流` GROUP BY）
  - ConversionFunnel 已加 `RangePicker` + `Select mode=multiple` 筛选器；KPI 从 `客户线索` 起步，移除了 `广告曝光`/`客户点击` 前置卡
  - 小红书笔记默认 `sort_field=开户人数 desc`（底表 2339 行里 93 行 >0，max=166 sum=778）
  - 主播分析 `g.assets` 只累加 `opened > 0` 行；`覆盖平台` 列用 `<Tag color=cyan>` 去重
  - Dashboard 趋势图下方已嵌入蓝色 5 档 `CalendarHeatmap`，由后端 `/reports/omni-channel/daily-calendar` 端点供数
- **`webdav/list` 500 报错（v3.1.3 #11 + v3.1.4 #8 延后项）**：保持延后至 v3.1.5+/未来版本重点排查；当前用户优先关注 1-6 项 BUG 落地。
- **build + 推送**：`npm run build` 0 error → dist 时间戳刷新 → `git push origin main --tags` → GitHub 同步看到 v3.1.5。

### v3.1.5 修复行动登记（2026-07-15）

| # | 优先级 | 影响面 | 任务 | 状态 |
|---|---|---|---|---|
| 1 | 高 | 6 个 v2 数据导入指南 | 替换首行为用户给的精确段位（1000.7 / 4 / 8.1 / 9.2 / 6.1 / 0.1）+ 关键类型名词加粗 | v3.1.5 已落地 |
| 2 | 中 | OmniChannel 第 4 卡 | 文档侧确认已用 `internetRow.opens`（v3.1.4 已修，c250a6d 可见） | v3.1.5 确认 |
| 3 | 中 | ConversionFunnel 筛选器 | 文档侧确认已加 `RangePicker` + 平台 `Select` + KPI 从 `客户线索` 起步 | v3.1.5 确认 |
| 4 | 中 | 小红书笔记排序 | 文档侧确认默认 `sort_field=开户人数 desc` | v3.1.5 确认 |
| 5 | 中 | 主播分析总资产 | 文档侧确认 `g.assets` 只累加 `opened > 0` 行；`覆盖平台` Tag 去重 | v3.1.5 确认 |
| 6 | 中 | Dashboard 日历热力图 | 文档侧确认 `<CalendarHeatmap>` 已嵌入 + 后端 `/daily-calendar` 端点供数 | v3.1.5 确认 |
| 7 | 低 | `webdav/list` 500 | 长尾根因排查延后（v3.1.3 #11 未排） | 延 v3.1.5+ |
| 8 | 中 | dist 滞后 | `npm run build` 0 error → 5000 端口 dist 时间戳刷新 + push v3.1.5 | v3.1.5 已落地 |

### v3.1.6 落地清单（2026-07-15）

- **webdav/list 错误粒度升级（502 + UPSTREAM_UNAVAILABLE）**：上一轮 v3.1.3 把后端错误包装为可读中文 message，但所有网络层错误都回 `500 Internal Server Error`，前端 `loadBackupList` 看到 500 时无法区分「代码 bug」和「坚果云远端不可达」。
  - v3.1.6 起：网络层错误（`无法连接` / `SSL` / `握手` / `重置` / `拒绝`）→ **`502 Bad Gateway` + `error: UPSTREAM_UNAVAILABLE`**
  - 其它异常（凭证错、JSON parse 错、IO 异常等）→ 仍 `500` + `error: LIST_FAILED`
  - 行为对前端是透明的：`DatabaseBackup` 的 `loadBackupList` 已经能从 response 拿到 `error` code + status code + message（v3.1.3 加了），现在 502 让用户更清楚是「远端 SSL 握手失败 / VPN 拦截」而非「程序出错」。
- **Flask 进程刷新（关键闭环）**：之前 PID 68668 启动于 2026-07-10 10:45（v3.1.4/v3.1.5 commit 之前），用户报的所有「GitHub 没看到更新」/「日历热力图没显示」/「筛选器没生效」/「数据错」现象都是这个 stale 进程导致 — 后端路由代码从未热加载过。
  - 本次 kill PID 68668 → 启动 dev mode Flask (PID 150056 → 165280) → 验证 `daily-calendar` 200 OK 返回真实 3 天数据 → `summary` 200 OK → `webdav/list` 502 UPSTREAM_UNAVAILABLE（v3.1.6 细分）。
  - 用户现在刷新浏览器即可看到 v3.1.4 + v3.1.5 + v3.1.6 的所有修复生效。
- **`webdav/list` 500 长尾根因（不是代码 bug）**：`dav.jianguoyun.com:443` SSL 握手被远端 reset/reject，复现于 `urllib3._ssl_wrap_socket_impl`，是本机网络/代理/VPN/服务端临时故障问题，不是本项目代码 bug。
  - 当前前端提示已清晰：`获取备份列表失败（UPSTREAM_UNAVAILABLE）：无法连接坚果云 WebDAV（连接被远端重置/拒绝）。请检查本机网络、防火墙、代理或 VPN 是否能访问 dav.jianguoyun.com:443，必要时在 .env 设置 WEBDAV_VERIFY_SSL=false 或 WEBDAV_PROXY。`
  - 解决路径：① 关闭 VPN / 切换网络；② 在 .env 配 `WEBDAV_VERIFY_SSL=false`；③ 配 `WEBDAV_PROXY`；④ 等待坚果云服务端恢复。

### v3.1.6 修复行动登记（2026-07-15）

| # | 优先级 | 影响面 | 任务 | 状态 |
|---|---|---|---|---|
| 1 | 高 | webdav/list 错误粒度 | 网络层错误细分：SSL/连接被重置 → 502 + UPSTREAM_UNAVAILABLE；其它 → 500 + LIST_FAILED | v3.1.6 已落地 |
| 2 | 高 | Flask 进程刷新 | kill PID 68668 (2026-07-10 stale 进程) → 启 dev mode Flask 加载 v3.1.4/5/6 代码 | v3.1.6 已落地 |
| 3 | 高 | `dav.jianguoyun.com:443` SSL 握手 | 长尾根因排查（v3.1.3 #11 / v3.1.4 #8 / v3.1.5 #7 三次延后）→ **不是代码 bug**，是远端/网络层；用户需关闭 VPN 或 .env 配 WEBDAV_VERIFY_SSL=false | 已闭环 |
| 4 | 中 | 后端 daily-calendar 200 验证 | curl smoke：3 天真实数据返回（2026-07-09 84 / 2026-07-10 60 / 2026-07-13 76） | v3.1.6 已落地 |
| 5 | 中 | OmniChannel summary 200 验证 | curl smoke：by_category 4 类齐全（合作机构 413754 / 自然流入 208264 / 员工开户 / 互联网引流） | v3.1.6 已落地 |
| 6 | 中 | 文档 + 推送 | AGENTS.md / CLAUDE.md 字节一致升级到 v3.1.6 + commit + tag + push | v3.1.6 进行中 |

## 4. 共享组件清单

| 组件 | 路径 | 职责 | 当前落地页 |
|---|---|---|---|
| `MetricCard` | `frontend-react/src/components/MetricCard/index.tsx` | 单张指标卡：title + icon + value + wowChange + suffix + description；支持 `formatter`（number/currency/percent）、`inverseTrend` | Dashboard / OmniChannel / ConversionFunnel / AgencyAnalysis / AppMarket/* / Live/Funnel / AnchorCluster / EmployeeConversion/Analysis |
| `MetricSection` | 同上 | 卡组容器：title + description + 响应式 4/3/2/1 grid（1200/768/576 三档断点） | 同上（v3.1.1 后所有报表头部） |
| `ReportFooter` | `frontend-react/src/components/ReportFooter/index.tsx` | 报表页底部弱化区：sources（结构化标签 / 值）+ notes（自由备注文本），字号 `--text-sm`，色 `--color-text-tertiary` | 所有报表页（除 XhsNotes/Operation 与 EmployeeConversion/Weekly） |
| `FunnelChart` | `frontend-react/src/components/Chart/FunnelChart.tsx` | 漏斗图：主实现 `@ant-design/plots` Funnel + `ErrorBoundary` 降级到 CSS 横条 | ConversionFunnel（双漏斗）/ Live/Funnel / AppMarket/Funnel |
| `sanitizeText` | `frontend-react/src/utils/sanitizeText.ts` | 客户端文本清洗：剥 BOM / NUL / 控制字符 / `\uFFFD` / 零宽，折叠空白 | Live/Funnel + AnchorCluster 表格渲染 |

## 5. 关键架构

### 5.1 后端分层（M / Q / V — 见 docs/库表重构设计_v3.md）

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

### 5.2 路由前缀

`API_PREFIX = /api/v1`（见 `config.py`），但部分蓝图用硬编码：`/api/v1/feishu`、`/api/v1/webdav`、`/api/v1/version`、`/api/v1/xhs-note-info`。v3.1 新增 `reports/` 蓝图：`/api/v1/reports/omni-channel/*` + `/api/v1/reports/app-market/*`。

### 5.3 WSGI 中间件
`app.py` 中 `DoubleApiRewriteMiddleware` 把 `/api/api/...` 重写为 `/api/...`，兼容旧版 JS 缓存的重复前缀 bug。

### 5.4 React Router SPA 兜底
`@app.before_request serve_react_app` 在路由匹配失败时返回 `index.html`，让前端路由接管；Flask 还显式提供 `/js/`、`/libs/`、`/assets/`、`/icons/` 静态目录。

### 5.5 前端结构（frontend-react/src/）

```
components/    # Chart / DataFreshness / Filter / GuideModal / HelpModal / Icon
                # MetricCard / MetricReportFooter (公共指标卡 + 底部说明)
stores/        # zustand: useAppStore, useFilterStore（筛选条件全局状态）
services/      # http.ts (HttpClient + 拦截器) / dataService / metadataService / uploadService
                # orvalMutator.ts（orval 生成的 fetcher 自定义实现）
types/         # api.ts（orval 生成，勿手改）/ api.schemas.ts / index.ts
utils/         # filterAdapter / agencyAnalysisChart / legacyLoader / sanitizeText
router/        # createBrowserRouter 配置（含旧路径 redirect：/reports/app-market → /app-market/funnel，/reports/omni-channel → /omni-channel）
layouts/MainLayout.tsx
styles/        # SCSS，variables.scss + global.scss + tokens.css + mixins.scss
pages/         # 顶级页面
                # Dashboard / OmniChannel / ConversionFunnel / LeadsDetail / AgencyAnalysis
                # XhsNotes/{List,Operation} / EmployeeConversion/{Analysis,Weekly}
                # Reports/AppMarket/{Funnel,Comparison,Detail,Creative} / Reports/OmniChannel
                # Live/Funnel (主播引流业务漏斗) / AnchorCluster / ReportGeneration
                # System/{DataImport,AccountManagement,AbbreviationManagement,DatabaseBackup}
```

### 5.6 数据库

- 默认 SQLite：`database/shengxintou.db`（路径可由 `DATABASE_PATH` env 覆盖）
- 启动时 `app.configure_sqlite_optimization()` 设置 PRAGMA（cache_size 100MB、synchronous=NORMAL、temp_store=MEMORY、busy_timeout=5s）；注意使用传统模式 journal_mode=DELETE（非 WAL），避免便携版数据库损坏
- `config.py` 同时定义 `FEISHU_TABLE_IDS`（数据库表 → 飞书 bitable ID 映射）和 `WEBDAV_*`（坚果云备份）配置

### 5.7 飞书 / WebDAV 集成

- `feishu_sync.py` 通过 `FEISHU_TABLE_IDS` 做双向同步；启用开关 `FEISHU_ENABLED`
- `webdav_backup.py` 用 `webdavclient3` 推送到坚果云，保留最近 `WEBDAV_MAX_BACKUPS` 个（默认 3），支持压缩 `WEBDAV_USE_COMPRESSION`

## 6. 数据导入流程（v2）

上传文件 → `POST /api/v1/upload` → `backend.routes.upload` 异步线程：

1. 创建 `DataImportLog` 记录（status/progress/inserted_rows/...）
2. 调用 `backend.processors.v2.raw_import.write_to_db(data_type, filepath)`
3. v2 原样导入：`pandas.read_excel` → 规范化（`nan`→NULL、时间解析、超长 ID 转字符串、`是/否`→0/1）→ `pandas.to_sql(if_exists='replace')`
4. 更新 `DataImportLog` 完成

> **关键**：v2 不算漏斗、不算转化率、不补映射 — 这一切都在 ETL 上游完成。下游查询只做 SELECT + 聚合。

## 7. 开发命令

### 7.1 后端（项目根目录）

```powershell
pip install -r requirements.txt

# 开发模式（标准 Flask，5000 端口）
$env:DEV_MODE='1'; python app.py

# 桌面模式（pywebview，打包版本用）
python app.py

# 重置数据库：删 database/shengxintou.db 后重启会自动 db.create_all()
```

### 7.2 前端（frontend-react/）

```powershell
cd frontend-react
npm install
npm run dev          # Vite dev server :3000，自动代理 /api -> 127.0.0.1:5000
npm run build        # tsc 类型检查 + vite build，产物到 dist/
npm run lint         # ESLint flat config (eslint.config.js)
npm run preview
npm run generate:api # orval -> src/types/api.ts
```

### 7.3 端到端测试（Playwright）

```powershell
cd frontend-react
npm run test
npm run test:headed
npm run test:report  # 打开 HTML 报告
```

### 7.4 构建产物路径说明

Flask 把 `frontend-react/dist/` 当模板 + 静态目录托管。**dev 时**前端用 vite dev :3000 走代理；**生产时**直接访问 Flask :5000 读 dist。
开发期改前端代码不需要重启 Flask（vite HMR 自动刷新）；改后端需要重启 Flask。
**生产前端看不到最新代码时** = dist 没构建，跑一次 `npm run build` 即可（5000 端口不需要重启 Flask，dist 文件被即时读取）。

### 7.5 一次性构建产物

后端 Flask 把 `frontend-react/dist/` 当模板 + 静态目录托管（见 `app.py`），所以前端构建后无需重启 Flask，刷新页面即可。但 React Router 兜底路由需要 dist 内的 `index.html` 存在。

## 8. 配置

复制 `.env.example` 为 `.env`（已 gitignored）。重要变量：
- `DATABASE_PATH`、`HOST`、`PORT`(5000)、`DEBUG`、`DEV_MODE`
- `FEISHU_APP_ID/SECRET/BITABLE_ID`、`FEISHU_ENABLED`
- `WEBDAV_URL/USERNAME/PASSWORD/BASE_PATH/MAX_BACKUPS/USE_COMPRESSION`
- `MAX_CONTENT_LENGTH`(MB)、`ALLOWED_EXTENSIONS`、`UPLOAD_FOLDER`、`LOG_FOLDER`、`LOG_LEVEL`

数据库/上传/日志目录若不存在会在启动时自动创建。

## 9. 注意事项 / 踩坑记录

- **不要动 `data.py.backup_20260211_174355`**：v0.9.1 拆分前的 4000 行单文件备份，仅留作对照
- **`models_v2.py` 列名含中文**（如 `AggVendorDaily.花费`、`FactConvContent.微信昵称`），SQLAlchemy 用 `Text`/`BigInteger`/`Float`，**禁止改列名以匹配业务字段**（会影响 `pd.to_sql` 落库）
- **报表头部数据卡片一律 `MetricCard + MetricSection`**；禁止在 page 内重新实现 `Card + Row/Col` 卡片组（小红书运营报表 XhsNotes/Operation 与 EmployeeConversion Weekly 周报海报子系统除外）
- **数据源 / 端点 / 口径说明一律放进 `ReportFooter`**，不要在 MetricCard description 或筛选卡里重复
- **乱码防御**：v3.1.2 起所有页面渲染 Excel 导入的脏字符字段（主播名 / 来源 / 备注等）前都要走 `sanitizeText()`，防止上游 GBK/控制字符渲染成方块
- **`POST /api/v1/conversion-funnel` 拆两套漏斗**：内容平台走 `fact_conv_content`，应用市场走 `fact_conv_appmarket`，响应带 `channel_category` 字段（见 `cost_analysis.py`）
- **`POST /api/v1/employee-conversion/analysis`** 顶部核心指标不过滤，从 `agg_daily_channel_open` + `agg_vendor_daily` 平台概览计算（v1.0 修复：旧版会被筛选过滤掉）
- **`POST /api/v1/employee-conversion/analysis-channel-overview`**：员工渠道概览，数据源 `agg_daily_channel_open`，**与 detail 端点是独立口径**（按用户口径与明细解耦），数字不一致是**预期**的，前端必须明确标注口径来源
- **`POST /api/v1/reports/omni-channel/*`**：单一独立数据源 `agg_daily_channel_open`，**禁止混合** fact_conv_* / agg_vendor_daily。占比由前端按响应数据实时算
- **`POST /api/v1/reports/app-market/*`**：数据源 `fact_conv_appmarket`（明细）+ `agg_vendor_daily`（创意），双源。creative 端点是客户端聚合
- **`/api/v1/data-freshness`**：返回 5 张新表数据状态。`critical`（>14 天）/ `warning`（>5 天）/ `normal`（≤5 天）
- **`funnel` 与 `split` 端点**：旧 `/conversion-funnel`（含 is_employee_mode 单端点）保留 1 个 release 加 deprecation，v3.2 删除；新代码走 `/conversion-funnel/split`
- **打包**：`省心投启动器.exe`（gitignored，7.7MB，PyInstaller 产物）+ `python-3.9-embed/` + `lib/` 便携版结构；dev 环境双击 exe 自动 fallback 到 `.venv/Scripts/python.exe`
- **orval**：不要手改 `src/types/api.ts`，必须通过 `npm run generate:api` 重新生成
- **数据源**：v2 上传识别 6 个新类型（account_mapping / conversion_content / conversion_appmarket / vendor_daily / xhs_note / channel_open）→ 旧 7 个类型 → 410 Gone
- **bizModel 推断**：`backend_conversions` 的 `business_model` 用 `customer_source` 推断（旧 bug：曾用 `traffic_type` 推断错误）
- **代理商分析小计/合计行**：`agency_analysis.py` 响应里带 `is_subtotal`/`is_total` 字段，前端展示指标卡片需跳过
- **Swagger**：`/apidocs` 可选（需装 flasgger，未列在 requirements.txt），app.py 已做 ImportError 容错
- **`@ant-design/plots` 漏斗图**：通过 `ErrorBoundary` 降级到 CSS 横条漏斗；数据传入前 `clean.filter(d => typeof d.count === 'number' && Number.isFinite(d.count))`，避免 g2 v5 抛错
- **`scripts/_write_docs.py` / `_patch_creative.py` 等** 一次性脚本：保留在 `scripts/` 下，不进 git 索引，使用时按需

## 10. 修复行动登记（v3.1.2 / v3.1.3 已落地）

### v3.1.2 已落地

| # | 优先级 | 影响面 | 任务 | 状态 |
|---|---|---|---|---|
| 1 | 高 | 4 处漏斗（ConversionFunnel ×2 / Live/Funnel / AppMarket/Funnel）| `FunnelChart` 切到 `@ant-design/plots` 的 `Funnel`，CSS 横条作 ErrorBoundary 降级 | v3.1.2 已落地 |
| 2 | 中 | 全渠道获客顶部 4 卡 | 第 4 张卡 title 动态化 + 占比上下文 | v3.1.2 已落地 |
| 3 | 中 | Live/Funnel + AnchorCluster 表格 | `sanitizeText()` 剥 NUL / 控制字符 / `\uFFFD` / 零宽 | v3.1.2 已落地 |
| 4 | 中 | AnchorCluster | 第 1 张卡冗余 description 移除（信息在 ReportFooter notes）| v3.1.2 已落地 |
| 5 | 中 | EmployeeConversion/Analysis | 切新 `MetricCard + MetricSection`；`ReportFooter` 标注双源对比口径（detail_caliber / channel_caliber）；双源 5 卡 description 清掉数据源 | v3.1.2 已落地 |
| 6 | 中 | 所有报表页（除 XhsNotes/Operation 与 EmployeeConversion/Weekly）| 数据源 / 端点 / 口径说明统一下沉到 `ReportFooter`，MetricCard description 仅保留轻量上下文 | v3.1.2 已落地 |
| 7 | 中 | 3 处漏斗图 | `Col span` 14/10 → 24，整行展示 | v3.1.2 已落地 |
| 8 | 中 | dist 滞后 | `npm run build` 5887 modules → 5000 端口同步 | v3.1.2 已落地 |

### v3.1.3 已落地（2026-07-14）

| # | 优先级 | 影响面 | 任务 | 状态 |
|---|---|---|---|---|
| 1 | 高 | XhsNotes/List 筛选器崩 | 4 个枚举 useState 改 `{value,label}[]` object array + `opts()` helper | v3.1.3 已落地 |
| 2 | 高 | 全渠道获客第 4 卡 | 换 `互联网渠道开户数` + KPI 完成率（年度 2万/1万 × 时间折算）| v3.1.3 已落地 |
| 3 | 中 | 互联网渠道数据概览 | 顶部 `DataFreshnessIndicator` 整块移除（import / useNavigate / freshnessRef / JSX 全部清干净）| v3.1.3 已落地 |
| 4 | 中 | MainLayout 侧栏 | `.sider` 改 `overflow-y: auto`，菜单 label `主播聚类` → `主播分析` | v3.1.3 已落地 |
| 5 | 中 | AppMarket/Detail 设备明细 | 行点击 → `Modal` + `Descriptions` 详情浮窗，参考 LeadsDetail 模式 | v3.1.3 已落地 |
| 6 | 高 | 主播聚类 → 主播分析 | IIFE 客户端按 `anchor` 聚合 `platforms/leads/...`；列改造；filter 加 `主播` Select；`pagination={false}` 一页呈现 | v3.1.3 已落地 |
| 7 | 高 | DataImport 布局 | Row/Col → Space 上下；DataTypeSelector 卡片缩小（140/12）；数据源自省心投系统导出声明 | v3.1.3 已落地 |
| 8 | 中 | GuideModal 问号乱码 | 6 个 v2 新类型映射 + 7 个 v1 旧类型保留兜底；`loadGuide` 增 `content-type: text/markdown` 校验 | v3.1.3 已落地 |
| 9 | 中 | System/DatabaseBackup | `loadBackupList` 透出后端 `error` code + 网络层 `status`，引导「测试连接」自检 | v3.1.3 已落地 |
| 10 | 中 | dist 滞后 | `npm run build` 0 error → 5000 端口同步（约 5887+ modules）| v3.1.3 已落地 |
| 11 | 低 | System/DatabaseBackup | `webdav/list` 500 长尾根因排查（用户本轮反馈「现在好像同步不了，会报错」，实测当前 200 OK + 凭证有效，问题大概率是历史/环境层面；后续 v3.1.4 跟进）| 未排 |

## 11. 修改守则

- 修改 `AGENTS.md` 或 `CLAUDE.md` 必须保持两者内容完全一致（字节一致 / 段落一致）。
- 修改业务查询前，先确认端点当前使用的源表和口径，不要照搬 README 或旧文档的过期描述。
- 不要改 `models_v2.py` 的中文列名来迎合前端字段；这些列名要与源表 / `to_sql` 结果对齐。
- 不要新增 mapping / 归一化 processor；确需处理新数据源时，优先补充上游 ETL 或 v2 原样导入映射。
- 不要复活旧上传类型、旧 v1 表、旧原生前端目录或历史迁移脚本。
- 不要手改生成文件，尤其是 orval 生成的 `src/types/api.ts`。
- 报表头部数据卡片一律使用 `MetricCard + MetricSection`；禁止在 page 内重新实现 `Card + Row/Col` 卡片组（小红书运营报表与 EmployeeConversion 周报海报子系统除外）。
- **数据源 / 端点 / 口径说明一律放进 `ReportFooter`**，不要在 MetricCard 的 `description` 或筛选卡里重复。
- 渲染 Excel 导入的脏字符字段前先走 `sanitizeText()`。
- **v3.1.3 起**：数据导入页用 `Space direction="vertical"` 上下布局，禁用 `Row/Col` 左右布局。
- **v3.1.3 起**：设备明细 / 线索明细等行级数据支持详情浮窗（Modal + Descriptions column={2}），参考 `LeadsDetail` 的浮窗组件 pattern。
- **v3.1.3 起**：主播聚类（现 `主播分析`）同名主播按 anchor 跨平台前端聚合，顶部加 `平台` + `主播` 双筛选，表格 `pagination={false}` 一页呈现。
- **v3.1.3 起**：侧栏菜单多时 `.sider` 用 `overflow-y: auto` 滚动，禁用 `overflow: hidden`。
- **v3.1.3 起**：OmniChannel 第 4 卡 = `互联网渠道开户数` + KPI 完成率，年度 2 万户 / 1 万有效户按 `dayOfYear/366` 时间折算；不再展示 TOP 合作机构占比。
- **v3.1.3 起**：Dashboard（互联网渠道数据概览）顶部不再显示数据状态卡；`DataFreshnessIndicator` 仅在「数据导入」「关于」页面保留。
- **v3.1.3 起**：`GuideModal` 必须校验 `content-type: text/markdown`，后端 SPA 兜底不会让 404 → index.html 被 ReactMarkdown 当 md 渲染成乱码；GUIDE_TITLES 增补 6 个 v2 新类型映射。
- **v3.1.3 起**：后端 `webdav/list` 500 错误透出 `error` code 到前端 `loadBackupList` 错误信息，便于用户用「测试连接」自检定位。
- 提交前确认：未把本地数据库 / 上传文件 / 备份文件 / `prototype/` / `tmp_*` / `logs/bug-fix-shots/` 加入索引；`.env` 与 `database/*.db` 已被 `.gitignore` 排除。
- 文档只描述当前真实状态；如果代码、`version.json`、README 冲突，**以代码和 `version.json` 为准**，并在文档中标注滞后点。

## 12. 验证建议

- 后端改动：优先跑相关端点的最小 smoke（如 `curl -X POST ...`），再视情况启动 `python app.py`；如果修改了 `backend/routes/*` 而 Flask 进程仍在跑，需手动重启。
- 前端逻辑 / 类型改动：优先跑 `npm run typecheck`，再跑 `npm run lint` 与必要页面 smoke。
- 前端样式改动：结合浏览器检查日/夜主题、报表头部卡片、表格和筛选栏；不要只看构建结果。
- 全量验证成本较高时，在最终说明里明确已跑和未跑的命令。
- **生产前端没看到最新代码**：先 `cd frontend-react && npm run build`，5000 端口不需要重启 Flask；确认 vite build 无 error 后再 curl 资源大小对比 dist 时间戳。

## 13. 文档索引

- `README.md`：用户视角介绍，部分版本描述可能滞后于 `version.json`。
- `docs/v3.1_报表重梳方案.md`：v3.1 菜单 / 双漏斗 / 双源 / 应用市场 / 直播占位设计。
- `docs/库表重构设计_v2.md`：v2 DIM/DWD/DWS 设计基线。
- `docs/库表重构设计_v3.md`：v3 实施与收尾对账。
- `docs/前端UI优化规划PRD.md`：v3.1.1 设计 token / 日夜模式 / 样式治理规划与验收标准。
- `docs/前端全栈改造清单.md`：React 迁移要点。
- `docs/数据库架构文档.md`：旧 13 表说明，查新表时优先看 v2/v3 重构文档。
- `docs/部署指南.md`：开发、生产、Docker、性能优化、监控与故障排查。
- `docs/uploads_cleanup_guide.md`：上传目录清理指引。
- `docs/*_legacy.md`：历史归档，仅作参考。