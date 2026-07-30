## 变更说明

<!-- 简述本次 PR 的目的与方案 -->

## 类型

<!-- 勾选所有适用项 -->

- [ ] 🐛 Bug 修复
- [ ] ✨ 新功能
- [ ] ♻️ 重构
- [ ] 📝 文档更新
- [ ] 🔧 CI / 工具链
- [ ] ⬆️ 依赖升级（Dependabot 自动）

## 影响范围

<!-- 勾选会涉及到的代码区域 -->

- [ ] 后端 API（`backend/routes/`）
- [ ] 数据模型（`backend/models_v2.py`）
- [ ] 数据导入（`backend/processors/v2/`）
- [ ] 前端页面（`frontend-react/src/pages/`）
- [ ] 共享组件（`frontend-react/src/components/`）
- [ ] 数据服务（`frontend-react/src/services/`）
- [ ] 类型（`frontend-react/src/types/`，需要重新 `npm run generate:api`）
- [ ] 跨端契约（`mobileRouteHandler.ts` / `features.ts` / `router/index.tsx`，详见 `docs/rules/cross-platform.md`）
- [ ] CI / Release（`.github/workflows/`）
- [ ] 文档（`README.md` / `AGENTS.md` / `CLAUDE.md` / `docs/`）

## 验证清单

<!-- PR 提交前必须逐项确认 -->

### 后端
- [ ] `python -m unittest discover -s tests/api -v` 全绿
- [ ] 新增 / 修改端点在 `tests/api/test_smoke.py` 加 smoke
- [ ] 数据库 schema 变更：`db.create_all()` 已验证 / 迁移脚本已写
- [ ] 旧表 / 旧端点未复活

### 前端
- [ ] `cd frontend-react && npm run typecheck` 0 错
- [ ] `cd frontend-react && npm run lint` 0 错
- [ ] `cd frontend-react && npm run build` 成功
- [ ] 改了 page：`tests/smoke/route-health.spec.ts` 加路由
- [ ] 改 `src/types/api.ts`：通过 `npm run generate:api` 重新生成（不手改）

### 跨端契约（勾选触发条件对应的对账脚本）
- [ ] 改后端 `@bp.route` 或 `mobileRouteHandler`：`python scripts/check_api_contract.py` 无新 drift
- [ ] 改 `router/index.tsx` 或 smoke 用例：`python scripts/check_route_drift.py` 无 drift
- [ ] 改 `features.ts` 或菜单：`python scripts/check_feature_flags.py` 无 ERROR
- [ ] 新增 `mobileRouteHandler` case：`python scripts/check_mobile_routes_coverage.py` 无新 drift，并在 `scripts/test_mobile_routes.py` 补对应 SQL 用例
- [ ] 新增/修改报表筛选器：`python scripts/check_filter_bar_usage.py` 无新 drift（筛选器用 FilterBar，不手写 RangePicker）

### 文档
- [ ] `python scripts/check_rule_architecture.py` 通过（自动校验双入口 SHA256、规则链接与版本漂移）
- [ ] 稳定规则写入 `docs/rules/`；版本历史只写入 `version.json`
- [ ] changelog 写入 `version.json`（如发版）
- [ ] 架构/公共入口变化已更新 `docs/rules/overview.md` 或对应专题规则

## 关联 Issue

<!-- Closes #xxx / Related #xxx -->

## 截图 / 录屏（如适用）

<!-- 改动可视化效果 -->

## 自检

- [ ] 我已读 `AGENTS.md` 及本次改动涉及的 `docs/rules/` 专题规则
- [ ] 我没有把本地数据库 / 上传文件 / `prototype/` / `tmp_*` / `logs/bug-fix-shots/` 加入索引
- [ ] `.env` 与 `database/*.db` 未被提交
- [ ] 我没有复活旧 v1 上传类型 / 旧原生前端目录 / 旧周报系统
- [ ] 我没有手改 orval 生成的 `src/types/api.ts`
