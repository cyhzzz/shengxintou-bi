---
name: shengxintou-bi-rules
description: 省心投 BI 项目开发与规则文档体系入口。当使用 AI Agent 对省心投 BI 进行开发、修改代码、修复 Bug、新增功能、理解架构或核验业务口径时，加载本 Skill 获取产品边界、架构、业务口径不变式、跨端契约、验证与发布红线；尤其适用于不支持 AGENTS.md/CLAUDE.md 的 Agent（如 Workbuddy、豆包），作为规则加载入口，在修改项目时自动调用。
metadata:
  author: 省心投 BI
  license: MIT
---

# 省心投 BI 开发规则文档体系

## 触发条件（何时使用本 Skill）

- 任何要对 **省心投 BI** 项目进行的**开发 / 改动**：改代码、修 Bug、加功能、重构、理解架构、核对数据口径、跑验证脚本。
- 使用 **不支持 `AGENTS.md` / `CLAUDE.md` 的 AI Agent**（如 Workbuddy、豆包）开发本项目时：将它们作为规则加载入口，进入项目上下文后即应在改动前加载本 Skill。
- 对 **支持 `AGENTS.md` 的 Agent**（如 Codex、Claude Code、TRAE）本项目通常已自带文档体系，可跳过本 Skill，直接使用仓库根级规则与 `docs/rules/`。

本 Skill 把项目根级 `AGENTS.md` / `CLAUDE.md` 和整套 `docs/rules/` 专题规则打包成可供任何 AI（含不支持 `AGENTS.md` 的平台）加载的规则入口。规则正文已内嵌在 `references/` 目录（复制自仓库，属快照）；**若同时在项目内工作，仓库 `docs/rules/` 与根级规则才是实时权威源，优先读仓库原文件，其次再读本 Skill 内嵌副本。**

## 你会需要的导航

### 规则优先级
1. 当前会话的系统、开发者和用户明确指令。
2. 目标文件所在目录中更深层的 `AGENTS.md`（若存在）。
3. 根级 `AGENTS.md` / `CLAUDE.md`（本 Skill 已内嵌其等价内容）。
4. `docs/rules/` 中与任务相关的专题规则。
5. `README.md`、部署文档和其他当前文档。
6. `docs/_archive/` 与 `docs/*_legacy.md` 仅供历史查阅，不作实现依据。

文档与实现冲突时，先以当前代码、构建配置、测试和 `version.json` 交叉验证，再修正文档；不要照搬历史说明。

### 按任务读哪条规则（必读索引）
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

### 单一权威源（谁说了算）
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

## 使用方式（本 Skill 的工作逻辑）

1. 进入省心投 BI 任务时加载本 Skill，先读本文件的导航与红线，判断当前改动属于哪类任务。
2. 按「按任务读哪条规则」表定位必读专题；优先读仓库 `docs/rules/<对应>.md`（实时），仓库不可用时读 `references/docs-rules/` 快照。
3. 涉及业务口径/跨端契约时，务必读 `business-invariants.md` 与 `cross-platform.md`，再动手。
4. 收尾跑对应最小验证 + 提交前 `scripts/pre-commit-check.bat`；不擅自 commit/push/发版。

> 维护提示：`references/` 是从 `docs/rules/` + 根 `AGENTS.md`/`CLAUDE.md` 复制的快照，规则变更后如要保持本 Skill 同步需重新复制；工作区实时权威源永远是仓库原文件。