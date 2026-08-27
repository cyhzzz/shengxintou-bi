---
name: shengxintou-bi-rules
description: 省心投 BI 的 AI 知识与数据助手（双模式）。开发模式：对本项目改代码/修 Bug/加功能/理解架构/核验业务口径时加载，提供产品边界、业务口径、跨端契约、验证与发布红线；数据助手模式：业务人员或在非项目目录时，基于本地省心投软件原始库表做数据问答、查询、排查与临时图表时加载，规范只读红线、库表定位、口径与输出目录，避免破坏已安装软件。
metadata:
  author: 省心投 BI
  license: MIT
---

# 省心投 BI — 知识与数据助手 Skill

本 Skill 有两种用途：**开发省心投 BI 项目**（沿用仓库开发规则体系），以及**充当省心投的业务数据助手**（在已安装软件的电脑上，基于原始库表做查询、排查、问答和临时图表）。**进入任务后第一步必须判定所处模式**，再决定可写范围与约束。

## 第一步：判定模式

1. 当前工作目录 / 上下文中存在 **项目仓库** 特征（有 `AGENTS.md` / `CLAUDE.md`、`app.py`、`config.py`、`docs/rules/`）→ **模式 A（开发模式）**。
2. 否则（尤其当用户想用本 Skill 分析已安装的省心投桌面软件、排查小问题或做数据问答时）→ **模式 B（数据助手模式）**。

模式判定决定了「能不能改软件文件夹下的代码」。**数据助手模式一律只能读，不能动软件目录代码。**

---

# 模式 A：开发模式（在项目仓库内）

这是原「开发规则文档体系」用法。`references/` 是这个模式的内嵌规则快照（复制自仓库，属快照）；**若同时在仓库内工作，`docs/rules/` 与根级规则才是实时权威源，优先读仓库原文件。**

## 触发条件（何时作为开发模式）
- 任何要对 **省心投 BI** 项目进行的**开发 / 改动**：改代码、修 Bug、加功能、重构、理解架构、核对数据口径、跑验证脚本。
- 使用 **不支持 `AGENTS.md` / `CLAUDE.md` 的 AI Agent**（如 Workbuddy、豆包）开发本项目时：将它们作为规则加载入口，进入项目上下文后即应在改动前加载本 Skill。
- 对 **支持 `AGENTS.md` 的 Agent**（如 Codex、Claude Code、TRAE）本项目通常已自带文档体系，可跳过本 Skill，直接使用仓库根级规则与 `docs/rules/`。

## 规则优先级
1. 当前会话的系统、开发者和用户明确指令。
2. 目标文件所在目录中更深层的 `AGENTS.md`（若存在）。
3. 根级 `AGENTS.md` / `CLAUDE.md`（本 Skill 已内嵌其等价内容）。
4. `docs/rules/` 中与任务相关的专题规则。
5. `README.md`、部署文档和其他当前文档。
6. `docs/_archive/` 与 `docs/*_legacy.md` 仅供历史查阅，不作实现依据。

文档与实现冲突时，先以当前代码、构建配置、测试和 `version.json` 交叉验证，再修正文档；不要照搬历史说明。

## 按任务读哪条规则（必读索引）
| 任务 | 先读 | 关键实现入口 |
| --- | --- | --- |
| 理解架构、增加模块/路由 | `overview.md` | `app.py`、`backend/routes/`、`frontend-react/src/router/index.tsx` |
| 修改漏斗、开户、资产、主播、对账 | `business-invariants.md` | `backend/routes/data/{cost_analysis,leads}.py`、`backend/routes/reports/app_market.py` |
| 修改模型、导入、API、SQLite、WebDAV | `backend.md` | `backend/models_v2.py`、`backend/processors/v2/raw_import.py`、`backend/routes/` |
| 修改 React、组件、筛选、类型、样式 | `frontend.md` | `frontend-react/src/` |
| 跨端兼容（API/路由/featureFlag/SQL 同步） | `cross-platform.md` | `mobileRouteHandler.ts`、`config/features.ts`、`scripts/check_*.py` |
| 测试、提交、CI、发布 | `testing-and-delivery.md` | `tests/`、`scripts/`、`.github/` |
| 打包、工具链、依赖工具位置 | `toolchain.md` | `scripts/build-installer.ps1`、`android/scripts/post-sync-patch.ps1`、`tools/` |
| 数据安全红线：打包/发布/数据库初始化 | `security-data-leak.md` | WebDAV 同步、空库生成、Release 资产 |
| 开发新需求 | `workflows/feature.md` + `templates/tech-spec.md` | — |
| 修复 Bug | `workflows/bugfix.md` | 相关回归测试目录 |

> 提示：以上文件在仓库内读 `docs/rules/<对应>.md`；不在仓库时读本 Skill 的 `references/docs-rules/<对应>.md` 快照。数据助手模式（模式 B）另见下文专门的「数据口径」小节。

## 单一权威源（谁说了算）
| 信息 | 权威源 | 规则 |
| --- | --- | --- |
| 当前版本/日期/版本号规则/changelog | `version.json` | 别处只引用，不复制 |
| 产品定位/安装/使用 | `README.md` | 规则只留任务所需摘要 |
| 会话入口与最高频红线 | `AGENTS.md`/`CLAUDE.md`/`.workbuddy/memory/MEMORY.md` | 三份必须字节一致 |
| 当前业务与工程规则 | `docs/rules/` | 只写当前有效状态 |
| 主播类型映射 | `backend/config/anchor_live_types.json` | 启动同步，别直接改库 |
| API 数据导入类型 | `backend/routes/upload.py::DATA_TYPES` | 前端常量跟随 |
| 业务表与中文列名 | `backend/models_v2.py` 及上游源表 | 不为迎合前端改名 |
| 前端生成 API 类型 | Orval 生成 | 禁止手改 `types/api.ts` |

## 产品边界（最容易越界的红线）

省心投 BI 是券商财富管理场景的**广告投放与开户转化分析平台**，职责严格限制为：

```text
上游 ETL 文件 -> 原样入库 -> SQL 查询/聚合 -> React 报表展示
```

- 上游 ETL 负责业务 mapping、清洗、归一化、字段补全、漏斗预计算和口径修正。
- 本项目导入层只做格式安全处理（空值、日期、布尔、超长 ID）。
- 查询层可 SELECT/SUM/GROUP BY/分页/兼容派生字段，**不新增下游业务口径补丁**。
- 新数据源必须走 `backend/processors/v2/raw_import.py`；旧 v1 上传类型返回 `410 Gone`，禁止恢复旧 processor/旧表。

## 最高风险业务不变式（改口径前必读详情）

- **新开户优先**：新开户及引进资产是主产出；存量客户/存量资产单独作辅助，不能混算。
- **内容平台非存量条件**：`是否为存量客户 == 0 OR IS NULL`；存量在有效线索之后剔除。
- **应用市场真实获客**：强制 `渠道类型 = 互联网引流`，统一用 `_funnel_filters`。
- **禁止漏斗变平**：不能用 `WHERE 是否新开户 == 1` 过滤整条应用市场漏斗；“新开户”是“开户成功”之后的阶段。
- **应用市场「开户成功」阶段**必须用 `是否创建完资金账号`（不是 `是否开户成功`），否则新开户人数会冒过开户成功人数。
- **双链路（加微/APP下载）不可混算**：APP激活 ≈ 线索、APP激活成本 ≈ 线索成本，列序紧贴线索。
- **复合来源线索均分**：同名主播跨平台聚合时，源头含多个主播的线索需按匹配主播数均分所有指标，避免重复计数。
- **主播映射**：`anchor_live_types.json` 是权威源，库表只是缓存；不直接改库维护。
- **青鸟导入**：`qingniao_leads` 按批次 append 是明确例外，其他 v2 类型默认 replace；`conversion_appmarket`/`vendor_daily` 按日期分区替换（保留 `2026-06-30` 之前历史，只重写 `07-01` 起，常量 `APPMARKET_CONV_REPLACE_FROM`/`VENDOR_DAILY_REPLACE_FROM`）。
- **代理商映射**：来自 `dim_account` 全称/简称/字母简称；不要恢复已删除的 `dim_vendor`。
- **数据安全红线**：APK/EXE/frontend-dist.zip 一律只内置表结构空库，真实业务库（含手机号/资产/创收）禁止进入任何分发产物与 Release 资产，仅由用户 WebDAV 从坚果云拉取；历史含数据 Release 资产必须清理。`docs/rules/security-data-leak.md` 是打包/发布/数据库初始化前必读。

## 架构地图（简）

后端：`app.py`（Flask/蓝图/SPA/中间件）+ `config.py` + `backend/`（models、models_v2、processors/v2/raw_import.py、routes/{data,reports,system}、utils）+ `server_entry.py`（PyInstaller 打包入口）。
前端：`frontend-react/src/`（router/layouts/pages/components/config/services/stores/types/styles/utils）。API 前缀 `/api/v1`。
四端单一代码库、仅配置不同：开发版（Web+SQLite）、桌面 Electron（PG/Supabase+AUTH_ENABLED=true）、移动端 Android（Capacitor SQLite）、PWA（IndexedDB+sql.js）。生产时 Flask 托管 `frontend-react/dist/`。

## 修改红线（做任何改动前确认）

- 先读后写：改前读完整目标文件、调用方和同类实现；只改需求范围、修根因，不夹带无关重构。
- 不改 `models_v2.py` 中文列名来迎合前端；不新增下游 mapping/归一化 processor。
- 不手改生成文件；API 类型走 `npm run generate:api`。
- 报表头统一 `MetricCard + MetricSection`；筛选器统一 `FilterBar`；数据源/端点/口径放 `ReportFooter`；Excel 脏文本 `sanitizeText()`。
- Flask 后台线程用显式 application context，不依赖继承 `current_app`。
- WebDAV 网络层错误 `502 + UPSTREAM_UNAVAILABLE`；其他列表失败 `500 + LIST_FAILED`。

## 验证（最小 → 按风险扩大）

| 改动 | 最小验证 |
| --- | --- |
| 规则架构/核心文件 | `python scripts/check_rule_architecture.py` |
| Python 后端 | `python -m unittest discover -s tests/api -v` |
| 前端 TS/TSX | `cd frontend-react && npm run typecheck` |
| 前端页面/组件/样式 | typecheck + `npm run build` |
| lazy 路由 | `npm run test:smoke` |
| 跨端契约 | `python scripts/check_api_contract.py` + `check_route_drift.py` + `check_feature_flags.py` + `check_mobile_routes_coverage.py` |
| 发版前 | `scripts/run-full-tests.bat` |

## 使用方式（开发模式工作逻辑）

1. 按「按任务读哪条规则」表定位必读专题；优先读仓库 `docs/rules/<对应>.md`（实时），仓库不可用时读 `references/docs-rules/` 快照。
2. 涉及业务口径/跨端契约时，务必先读 `business-invariants.md` 与 `cross-platform.md`，再动手。
3. 收尾跑对应最小验证 + 提交前 `scripts/pre-commit-check.bat`；不擅自 commit/push/发版。

---

# 模式 B：数据助手模式（不在项目仓库内，面向已安装软件的原始库表）

本模式服务**业务人员**：基于本地省心投软件的实际数据，做小问题排查、数据问答、查询和临时图表。本模式**不是**在写项目代码，**绝不能破坏已安装的软件**。

## B1. 第一步：确认软件目录与原始库表

- 确认已安装/运行的省心投软件目录（例如本机 `D:\Program Files\shengxintou\shengxintou-bi-desktop`）。可通过询问用户、或用系统搜索 / 常见安装路径探测。
- **数据库通常在用户数据目录而非安装目录**（桌面版 frozen 构建）：默认 `%APPDATA%\省心投 BI\database\shengxintou.db`（即环境变量 `APPDATA` 下 `省心投 BI\database\shengxintou.db`，可用 `SHENGXINTOU_USER_DATA_DIR` 覆盖）。安装目录只含程序代码与只读 `resources/`，一般**没有**实时业务库。
- 允许的定位顺序：
  1. 环境变量 `SHENGXINTOU_USER_DATA_DIR` 指向目录下的 `database/shengxintou.db`；
  2. `%APPDATA%\省心投 BI\database\shengxintou.db`；
  3. 用户自定 `DATABASE_PATH` 指向的路径；
  4. 若 `.env` / 环境变量配了 `DATABASE_URL=postgresql+psycopg://...`（Supabase PG），则数据在云端 PG，需另行告知用户走 WebDAV 同步到本地 SQLite 再分析，本模式不直连云库。
- 拿到库后用**只读**方式打开并 `SELECT name FROM sqlite_master WHERE type='table'` 自省表与列结构（表列含中文，与 `models_v2.py` 及上游源表 1:1 对齐）。

## B2. 只读红线（避免破坏软件）

- **只允许 SELECT 查询**；禁止对实时业务库执行 UPDATE / INSERT / DELETE / DROP / ALTER / VACUUM 等写操作。优先用只读连接打开（如 SQLite URI `file:...?mode=ro` 或 SQLAlchemy 只读 URI）。
- **不得修改、新建、删除软件仓库目录下的任何代码/配置文件**（`resources/` 只读区、`server.exe`、`.env` 等一律不动）。
- 需要往库里写临时表/中间结果时，**不要写进业务库**，改为在输出目录生成独立 SQLite 文件，或用 SELECT 派生直接得到结果。
- 若遇到「软件正在运行」占用了数据库文件，不要强制改锁，改为复制该 DB 到 `./.技能临时分析` 后用副本分析（保持原件只读）。

## B3. 输出目录约定（所有产物放这里）

- **所有**产物（查询 SQL、结果 CSV/JSON、图表 PNG/HTML、分析说明 Markdown）统一放到：**`<软件目录>/.技能临时分析/`**。
- 若 `<软件目录>` 不可写（例如 Program Files 权限不足），回退到 `$HOME/.省心投技能临时分析/` 并明确告知用户实际存放位置。
- 每次分析按文件名/时间组织（如 `查询结果_2026-08-26.csv`），不覆盖软件原始文件；最后用一句话汇报产物所在路径清单。

## B4. 数据口径（回答业务问题必须遵守，否则数字是错的）

- **新开户优先**：新开户及引进资产是主产出；存量客户/存量资产单独作辅助，不能混算。报告口径一律「非存量」= `是否为存量客户 == 0 OR IS NULL`（内容平台在「有效线索」之后剔除存量）。
- **应用市场**：只统计 `渠道类型 = 互联网引流` 的真实获客；「开户成功」阶段用 `是否创建完资金账号`；不要用 `是否新开户=1` 过滤整条漏斗（会变平）；新增资产只累计 `是否新开户=1` 行。
- **双链路不可混算**：加微链路主指标=线索数、APP下载链路主指标=APP激活人数（APP激活≈线索、APP激活成本≈线索成本），列序「线索→APP激活→开户」。
- **复合来源线索**：画面含多个主播的线索，聚合各指标时按匹配主播数均分，避免虚增。
- **主播映射**：JSON 是权威源，库表只是缓存；查询展示以 `dim_anchor_live_type` 已同步的映射为准。
- 回答时标注数值口径与「近似/估算」，别把存量当新开户、别把加微和APP激活混着说。

## B5. 敏感数据处理

- 库内含客户手机号、资产、创收等敏感字段。**不要**把整表/大批量原始手机号或资产明细原样导出到分析产物；优先返回聚合、分桶、去标识结果。
- 图表和表格中如需展示，做脱敏/聚合；同样遵守 `security-data-leak.md`：分析产物不与仓库分发、不打包进任何发布物。
- 面向业务人员的问答以「概括性结论 + 关键数字 + 口径说明」为主，不倾倒原始明细。

## B6. 数据助手模式工作流程

1. 判定模式为 B → 确认软件目录 → 定位并只读打开原始库 → `sqlite_master` 自省结构。
2. 与用户对齐想回答的问题/要排查的现象；按 B4 口径设计 SELECT。
3. 查询结果写入 `<软件目录>/.技能临时分析/`；需要看趋势/对比时生成临时图表（PNG/HTML）到该目录。
4. 汇报结论、口径说明与产物路径；提醒敏感数据处理方式。全程不触碰软件目录代码与实时库写操作。

---

> 维护提示：本文件在 `skills/shengxintou-bi-rules/SKILL.md`；`references/` 是从 `docs/rules/` + 根 `AGENTS.md`/`CLAUDE.md` 复制的快照。根级规则或 `docs/rules/` 调整时，需把根级规则与 `docs/rules/` 重新复制到 `references/`，保持分发版与权威源一致。