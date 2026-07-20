# 测试、协作与交付规则

## 1. 验证原则

1. 先运行与改动最相关、最快的检查，再按风险扩大范围。
2. 测试只证明其覆盖的行为；不要用单个 smoke 支持“全功能正确”的结论。
3. 不为修复目标之外的失败做无关重构；记录并区分基线问题。
4. 命令是否成功以退出码和产物/状态复核为准，不只看 stdout 文案。
5. 规则或文档改动不需要运行无关全量 UI 功能测试，但规则检查必须通过。

## 2. 影响范围到验证命令

| 影响范围 | 必跑 | 条件性验证 |
| --- | --- | --- |
| `AGENTS.md`、`CLAUDE.md`、`docs/rules/` | `python scripts/check_rule_architecture.py`、`git diff --check` | 修改检查脚本时加 `py_compile` |
| Python 后端路由/查询 | `python -m unittest discover -s tests/api -v` | 新逻辑增加定向测试 |
| 模型/导入 | API smoke + 隔离数据库样例 | replace/append、主键、类型和已有库兼容 |
| 前端 TS/TSX | `npm run typecheck` | 页面/组件再跑 build |
| 前端样式或构建配置 | `npm run build` | lint、视觉检查 |
| 路由/lazy 页面 | typecheck/build + `npm run test:smoke` | 功能 spec |
| Bug 修复 | 最小回归用例 | 受影响模块更广测试 |
| CI/setup/release 脚本 | 对应语法检查和独立命令 | 在 CI 或安全沙箱验证副作用流程 |
| 发版 | `scripts/run-full-tests.bat` 或等价全量流程 | 便携包启动与 Release 产物 |

前端命令默认在 `frontend-react/` 目录运行。

## 3. 测试目录职责

- `tests/api/test_smoke.py`：只读、快速的 Flask test client API smoke。
- `frontend-react/tests/smoke/`：公开路由健康检查。
- `frontend-react/tests/functional/`：页面级功能测试，适合发版前执行。
- `frontend-react/tests/regression/`：历史 Bug 的最小回归用例。

不要在规则中硬编码测试数量；以测试发现结果和目录当前内容为准。

### 新增测试

- 每个新增核心 API 至少增加一条快速 smoke，验证成功响应和关键结构。
- 每个新增 lazy 公开路由增加路由 smoke。
- 每次修复可复现 Bug，在已有测试体系中增加最小回归用例。
- 冒烟测试不做昂贵业务断言、不写用户数据库、不依赖真实外部网络。
- 如果邻近模块没有任何测试基础设施，不为单次小改动引入全新测试框架。

## 4. 本地检查入口

### 快速提交前检查

`scripts/pre-commit-check.bat` 是 Windows 快速入口，执行规则架构检查、后端 API smoke 和前端构建。脚本有变更时，确保每个步骤只执行一次并保留真实退出码。

### 全量功能检查

`scripts/run-full-tests.bat` 用于发版前，包含后端、构建和 Playwright 功能测试。日常文档或局部修复不要默认运行全量流程。

### 开发服务

- `scripts/start-dev.bat` 检查端口并启动 Flask/Vite。
- `scripts/stop-dev.bat` 优先读取 PID 文件，再按端口回退停止。
- 日志和 PID 位于 `logs/`，均是本地产物，不提交。

## 5. CI

`.github/workflows/ci.yml` 在 push/PR 上至少覆盖：

- 规则架构检查。
- 后端 API smoke。
- 前端 typecheck、lint 和生产构建。
- setup 脚本语法检查。

修改 CI 时：

- 使用 lockfile 和 `npm ci`，保持 Node/Python 版本与工作流当前基线一致。
- 给 job 设置合理 timeout。
- 不在日志输出 secret。
- 新检查应独立、快速、错误信息可定位。
- Windows/PowerShell 与 Bash 语法分别在对应 shell 验证。

## 6. Git 与工作区安全

- 不回滚、覆盖或清理用户未提交改动。
- 提交前查看 `git status`、`git diff` 和 `git diff --cached`，确认边界。
- 不把 `.env`、数据库、上传文件、备份、日志、临时脚本、prototype 或测试截图加入索引。
- 不手改生成文件，尤其是 `frontend-react/src/types/api.ts`。
- 未经用户明确要求，不 commit、push、建分支、打 tag 或创建 PR。
- Git 操作成功后用 `git status` / `git log` / 远端状态复核，不只依赖命令文案。

## 7. PR 与协作

- 使用 `.github/ISSUE_TEMPLATE/` 和 `.github/PULL_REQUEST_TEMPLATE.md` 当前模板。
- PR 标题采用 `feat:`、`fix:`、`refactor:`、`docs:`、`chore:` 等 Conventional Commits 前缀。
- PR 影响范围和验证清单应与实际 diff 一致，不能机械全勾。
- 修改规则架构时运行自动检查，不再靠人工肉眼保证 `AGENTS.md` / `CLAUDE.md` 同步。
- merge/review 策略遵守仓库维护者和平台设置，Agent 不自行假设可 squash 或直接推 main。

## 8. 版本与发布

- 当前版本、发布日期、版本号进位规则和 changelog 的唯一权威源是 `version.json`。
- 普通功能开发不在规则文件追加“已落地”章节。
- 发版脚本 `scripts/release.bat` / `release.sh` 会修改版本、commit、tag 和 push，属于高副作用操作；只有用户明确要求发版时运行。
- 发布前先让用户补全 changelog，不接受脚本生成的“待补”占位条目作为正式发布说明。
- GitHub Actions release 负责前端构建、PyInstaller、便携包和 GitHub Release；不要并行手工制作另一套发布产物。
- Release 失败时先查看 Actions job 和产物阶段，不用本地临时 zip 掩盖流水线问题。

## 9. 文档交付

- README 只维护产品、安装、使用、结构和面向使用者的文档索引。
- 规则只描述当前有效状态；版本历史进入 `version.json`，过期设计进入 `docs/_archive/`。
- 修改 `AGENTS.md` 或 `CLAUDE.md` 必须同步并运行规则检查。
- 文档提到文件、命令、端点和表时，至少通过当前仓库存在性或代码搜索交叉验证。
- 不把本地被 `.gitignore` 排除的 spec 当成已交付的版本化文档，除非项目明确选择该目录。

