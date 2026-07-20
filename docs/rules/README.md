# 省心投 BI 规则导航

本目录保存**当前有效**的业务与工程规则。根目录 `AGENTS.md` / `CLAUDE.md` 只保留每次会话必须加载的摘要；执行具体任务时按本页索引读取对应规则。

## 规则优先级

1. 当前会话中的系统、开发者和用户明确指令。
2. 目标文件作用域内更深层的 `AGENTS.md`（若未来新增）。
3. 根目录 `AGENTS.md` / `CLAUDE.md`。
4. 本目录中与任务相关的专题规则。
5. `README.md`、部署指南和其他当前文档。
6. `docs/_archive/` 与 `docs/*_legacy.md` 仅供历史查阅，不作为当前实现依据。

文档与实现冲突时，先以当前代码、构建配置、测试和 `version.json` 交叉验证，再修正文档；不要照搬历史说明。

## 按任务阅读

| 任务 | 必读规则 | 关键实现入口 |
| --- | --- | --- |
| 理解整体架构、增加模块或路由 | [`overview.md`](overview.md) | `app.py`、`backend/routes/`、`frontend-react/src/router/index.tsx` |
| 修改漏斗、开户、资产或主播口径 | [`business-invariants.md`](business-invariants.md) | `backend/routes/data/cost_analysis.py`、`backend/routes/reports/app_market.py`、`backend/routes/data/leads.py` |
| 修改模型、导入、API、SQLite、WebDAV | [`backend.md`](backend.md) | `backend/models_v2.py`、`backend/processors/v2/raw_import.py`、`backend/routes/` |
| 修改 React 页面、组件、筛选、类型或样式 | [`frontend.md`](frontend.md) | `frontend-react/src/` |
| 决定测试范围、提交、CI 或发布 | [`testing-and-delivery.md`](testing-and-delivery.md) | `tests/`、`frontend-react/tests/`、`scripts/`、`.github/` |
| 开发新需求 | [`workflows/feature.md`](workflows/feature.md) | [`templates/tech-spec.md`](templates/tech-spec.md) |
| 修复 Bug | [`workflows/bugfix.md`](workflows/bugfix.md) | 相关回归测试目录 |

## 单一权威源

| 信息类型 | 权威源 | 维护规则 |
| --- | --- | --- |
| 当前版本、发布日期、版本号规则、changelog | `version.json` | 其他文档只引用，不复制当前版本号或版本流水账 |
| 产品定位、安装、运行和用户入口 | `README.md` | 规则文档只保留实现任务所需摘要 |
| AI 会话入口和最高频红线 | `AGENTS.md` / `CLAUDE.md` | 两份文件必须字节一致 |
| 当前业务与工程规则 | `docs/rules/` | 只描述当前有效状态，不记录每次发版历史 |
| 主播类型映射 | `backend/config/anchor_live_types.json` | 启动时同步到 `dim_anchor_live_type`，不要直接改库维护 |
| API 支持的数据导入类型 | `backend/routes/upload.py` 的 `DATA_TYPES` | 前端常量、指南与测试应跟随它同步 |
| 数据库表与中文列名 | `backend/models.py`、`backend/models_v2.py` 和上游源表 | 不为迎合前端重命名业务列 |
| 前端生成 API 客户端 | Orval 配置和生成命令 | `frontend-react/src/types/api.ts` 禁止手改 |
| 已批准功能设计 | 项目当前使用的 spec 目录 | 不回填到根规则，不替代当前代码 |
| 历史设计和过期说明 | `docs/_archive/`、`docs/*_legacy.md` | 仅供追溯 |
| AI 规则构建 Prompt 可移植版本 | `docs/6a2aaa141b82ca7bef7bccb8_AI项目Spec规则构建Prompt.md` | 仅供查阅，规则迁移时参考其检查清单 |

## 文档职责边界

- **根规则**：项目边界、最高风险红线、规则索引、最小验证和 Git 安全。
- **专题规则**：稳定模块边界、业务不变式、生成物、常见陷阱和验证映射。
- **TECH_SPEC**：单个需求的方案、风险和验收标准；完成后仍保留为设计证据。
- **`version.json`**：唯一版本历史，不把“某版本已落地”章节复制回规则。
- **Issue / PR**：待办、缺陷、评审和交付状态，不在规则中长期维护临时事项。

## 维护约定

1. 修改规则前先确认信息类型的权威源，避免在多个文件复制同一动态事实。
2. 新规则必须满足：可复用、会影响正确性、无法轻易从代码直接看出。
3. 单次 Bug 的实现细节不自动升级为长期规则；只有高风险、可复现的模式才沉淀。
4. 架构、模块边界或公共契约变化时更新专题规则和导航；普通页面功能不更新根规则。
5. 修改 `AGENTS.md` 后同步 `CLAUDE.md`，并运行 `python scripts/check_rule_architecture.py`。
6. 不在规则中硬编码测试数量、文件数量、当前版本号等高频变化数据。

