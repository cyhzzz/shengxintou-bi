# 业务口径与数据不变式

修改任何漏斗、开户、资产、主播、应用市场或对账查询前，必须先确认当前端点源表和本文件口径；历史 PRD 和版本记录不能替代当前实现。

## 1. 数据职责边界

- 上游 ETL 负责业务 mapping、清洗、归一化、字段补全、漏斗预计算和口径修正。
- 本项目导入层只做文件读取及格式安全处理：空值、日期、布尔、超长 ID 等。
- 查询层允许 SELECT、SUM、GROUP BY、分页和兼容派生字段，不新增下游业务口径补丁。
- 新数据源必须进入 `backend/processors/v2/raw_import.py`；旧 v1 processor、旧表和旧上传类型不可恢复。
- `qingniao_leads` 的批次 append 是已存在的明确例外，不应推广为其他数据类型的默认导入模式。
- `conversion_appmarket`（应用市场转化明细）支持增量追加：前端开关关闭"全量替换"时，导入前先按 `设备号 + 下载日期` 删除匹配的旧记录，再 append 新记录，保留其他日期的数据。去重键为 `设备号 + 下载日期`（业务上可唯一识别同一条线索）。开关开启时仍为全量替换（清空整表再写入）。

## 2. 新开户与存量客户

获客类报表的核心产出是新开户客户及其引进资产。存量客户服务和存量资产只作辅助，两者不能混算。

- **新开户**：首次完成开户，产生新增开户量和引进资产。
- **存量客户**：已开户客户再次出现在当前渠道，不代表新增获客。
- 涉及“开户成功”的报表应进一步拆分新开户与存量客户。
- 内容平台的非存量条件统一为：`是否为存量客户 == 0 OR IS NULL`。
- 新开户、新有效户和新增资产采用非存量口径；存量线索和存量资产单独呈现。
- 前端不得把后端已经拆分的新/存量指标重新混成一个主指标。

## 3. 应用市场漏斗

### 行粒度

`fact_conv_appmarket` 每行是一台设备。阶段布尔字段是渐进式的：走到后段的设备，其前置阶段字段也为 `1`。

### 禁止用新开户过滤整条漏斗

禁止 `WHERE 是否新开户 == 1` 后再 SUM 所有阶段。这样会只留下已走到开户后的设备，导致激活、注册、开户等前置阶段全部相等，漏斗变平。

正确方式：

```text
激活 APP -> 开户注册 -> ... -> 开户成功 -> 新开户 -> 入金 -> 有效户
```

“新开户”是“开户成功”之后的阶段，不是整条数据集的过滤条件。存量客户通过“开户成功 - 新开户”自然体现。

### 开户成功阶段口径

应用市场漏斗的「开户成功」阶段必须使用 `是否创建完资金账号`，而非 `是否开户成功`。上游存在「开户成功=0 但 创建完资金账号=1 且 新开户=1」的倒挂数据，用旧字段会导致新开户人数大于开户成功人数。关键实现：`backend/routes/reports/app_market.py::FUNNEL_STAGES`（v3.5.7 起）。

### 真实获客渠道

- 应用市场广告真实产出只统计 `渠道类型 = 互联网引流`。
- 合作机构、员工开户、自然流入等设备可能只是下载 APP 时误点应用市场广告，不能计入应用市场获客产出。
- 漏斗、总览和计划分析等获客口径统一使用 `_funnel_filters`。
- 不要用允许任意 `channel_types` 的 `_apply_filters` 替代 `_funnel_filters`。
- 口径固定为互联网引流的页面不应再提供有歧义的渠道类型筛选。
- 应用市场新增资产只累计 `是否新开户 == 1` 设备行的 `总资产`。

关键实现：

- `backend/routes/reports/app_market.py`
- `backend/routes/data/cost_analysis.py`
- `frontend-react/src/pages/Reports/AppMarket/`
- `frontend-react/src/pages/ConversionFunnel/`

## 4. 双链路业务区分（APP 下载链路 vs 加微链路）

`agg_vendor_daily` 同时承载两类业务链路，**必须按厂商所属链路解读指标，不能混算**。

| 维度 | 加微链路 | APP 下载链路 |
|---|---|---|
| 代表厂商 | 量子、信则、风声等大多数厂商 | kiwi、哇棒、有米 |
| 主指标 | 线索数（=企微数） | APP激活人数 |
| 次指标 | 开口人数 / 开户人数 | 开户人数（链路后段共用） |
| 成本指标 | 线索成本（加微成本） | APP激活成本 |
| 字段位置 | `agg_vendor_daily.线索数 / 开口人数 / 开户人数` | `agg_vendor_daily.APP激活人数 / 开户人数` |

业务含义近似性：

- **APP激活 ≈ 线索**：APP 下载链路中，用户下载并激活 APP 才算"前端回传激活"，等价于加微链路中用户留下联系方式成为"线索"。
- **APP激活成本 ≈ 线索成本**：花费 / APP激活人数，与花费 / 线索数口径对齐。

报表列序与指标切换必须反映这种业务链路位置：

- 数量列顺序：曝光 → 点击 → 线索 → **APP激活** → 开户 → 有效户（APP激活紧贴线索后、开户前）
- 成本列顺序：线索成本 → **APP激活成本** → 开户成本（APP激活成本紧贴线索成本后、开户成本前）

涉及报表：厂商分析（`/api/v1/agency-analysis`）、投放评审（`/api/v1/investment-review`）。

关键实现：

- `backend/routes/data/agency_analysis.py`
- `backend/routes/data/investment_review.py`
- `frontend-react/src/pages/AgencyAnalysis/`
- `frontend-react/src/pages/InvestmentReview/`
- `frontend-react/src/services/mobileRouteHandler.ts`（`handleAgencyAnalysis` / `handleInvestmentReview`，SQL 必须与后端完全一致）

## 5. 内容平台漏斗

`fact_conv_content` 每行是一条线索，新增客户线索在开口、有效、开户等阶段仍可能为 `0`，因此可以保留递减漏斗。

存量剔除发生在“有效线索”之后：

```text
客户线索
-> 客户开口
-> 有效线索（全部）
-> 有效线索（剔除存量）
-> 成功开户（新）
-> 有效户（新）
```

- `cq_all` 统计全部线索、开口和有效线索。
- `cq_new` 使用非存量条件，统计剔除存量后的有效线索、成功开户和有效户。
- 非有效线索也可能实际开户，因此“成功开户”偶尔大于“有效线索（剔除存量）”属于可能的业务现象，不能强制截断。

## 6. 员工、直播与小红书

- 涉及开户量和资产时，新开户/引进资产为主指标，存量客户/存量资产为辅助指标。
- 直播和主播分析的非存量条件与内容平台一致。
- 同名主播需要按归一化 `anchor` 跨平台聚合，平台列表去重展示。
- 使用后端返回的 `new_assets`、`existing_assets` 和 `assets` 语义；前端只做跨平台求和，不另造开户过滤口径。
- 主播表保持一页呈现时使用 `pagination={false}`，不要因默认分页隐藏主播。
- **复合来源线索均分**：线索的 `客户来源` 可能出现多个主播（如 `抖音引流-周乐意,抖音引流-杨毅`）。anchor 聚合（`anchor-clusters`、`anchor-weekly-analysis`）必须按匹配主播数均分线索、开口、开户、资产等所有指标，避免同一线索被累加到每个主播造成总数虚增。关键实现：`backend/routes/data/leads.py` 与 `frontend-react/src/services/mobileRouteHandler.ts`（SQL/算法必须完全一致）。

## 7. 主播直播类型

### 权威源与同步

- 权威配置：`backend/config/anchor_live_types.json`。
- 数据库 `dim_anchor_live_type` 是查询缓存，不是人工维护源。
- 启动时 `_sync_anchor_live_types_from_json` 执行：JSON 新增则插入、已有则更新、JSON 删除则软删除为 `is_active=0`。
- 没有管理页面；不要直接改库维护映射。

### 枚举

- `分析师`
- `投顾IP`
- `投顾配合做带货`
- `带货直播`

### token 规则

`fact_conv_content.客户来源` 按 `[,，;；、]` 拆成 `source_token`。配置将 token 映射为归一化 `anchor_name`、`live_type` 和备注。

- 纯人名、`视频号引流-人名`、`财联社引流-人名`通常归 `投顾IP`。
- 分支投顾的 `抖音引流-人名`和`抖音引流-直播带货-人名`归 `投顾配合做带货`。
- 总部投顾、分析师、带货主播的抖音 token 按配置中的本身类型。
- `直播带货-人名`：带货主播归 `带货直播`，投顾归 `投顾配合做带货`。
- `小鹅通直播-人名`按主播本身类型。
- 错字校正等具体名单只维护在 JSON，不在规则文档复制，避免双重权威源。

未配置 token 仍可按正则得到主播名，但 `live_type` 为空；新增映射应修改 JSON 并验证两个主播端点。

关键端点：

- `POST /api/v1/leads-detail/anchor-clusters`
- `POST /api/v1/leads-detail/anchor-clusters-trend`

## 8. 代理商三态字段

- `dim_account` 保存 `agency_name`（全称）、`agency_short`（简称/显示名）、`agency_letter`（字母简称）。
- `agg_vendor_daily.厂商` 和 `fact_conv_content.广告代理商` 保存全称。
- 同一代理商在不同平台的全称可能不同，简称是共同展示/筛选键。
- 映射由 `backend/utils/agency_mapper.py` 从 `DimAccount` 构建；当前实际使用 `agency_short` ↔ `agency_name` 映射，`agency_letter` 字段在 ORM 与 CRUD 保留但 agency_mapper 暂未使用，新增筛选逻辑前先核实使用情况。
- 不要恢复已删除的 `dim_vendor` 表。
- SQL 按全称过滤，UI 使用简称时必须通过映射展开/补充。

## 9. 抖音青鸟对账

- 青鸟导入按 `批次标注` append；默认标注为导入时间格式，页面允许用户指定。
- 匹配键为青鸟“微信线索昵称 + 日期”与系统“微信昵称 + 线索日期”。
- 昵称归一化实现以 `backend/routes/data/data_reconciliation.py::normalize_nickname` 为准，不在前端复制算法。
- 日期容差由请求传入，后端限制在 `0-30` 天，页面默认值以当前实现为准。
- 多候选时选日期差最小记录；批次筛选只限制青鸟侧数据。
- 标志位转换和差异判定由后端完成，前端展示后端结果，不自行重算匹配状态。

