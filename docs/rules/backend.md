# 后端开发规则

## 1. 修改前定位

后端改动前按问题类型读取：

| 任务 | 入口 |
| --- | --- |
| 应用启动、静态托管、中间件、SQLite 参数 | `app.py` |
| 环境变量和路径 | `config.py`、`.env.example` |
| 系统表 | `backend/models.py` |
| 业务表和中文列 | `backend/models_v2.py` |
| 文件导入 | `backend/routes/upload.py`、`backend/processors/v2/raw_import.py` |
| 常规查询 | `backend/routes/data/` |
| 专题报表 | `backend/routes/reports/` |
| 自更新 | `backend/routes/system/self_update.py` |
| WebDAV | `backend/routes/webdav_backup.py`、`backend/utils/webdav_client.py` |

修改业务查询前必须确认：端点路径、当前源表、行粒度、过滤器、空值语义和新/存量口径。README 或历史 PRD 只能帮助定位，不能替代代码核对。

## 2. 模型与数据库

- `backend/models.py` 只放系统表；业务 ORM 放 `backend/models_v2.py`。
- 当前业务模型以文件中的类定义为准，不在规则中硬编码表数量。
- `models_v2.py` 的中文列名必须与上游文件和 `pandas.to_sql` 落库结果一致，禁止为了前端字段名改列。
- 新模型需要在应用启动路径中注册，确保 `db.create_all()` 能看到 metadata。
- 默认 SQLite 使用 `journal_mode=DELETE`，不要切换为 WAL。
- 修改 SQLite 参数前读取 `app.configure_sqlite_optimization()`，保留便携应用和并发导入场景。
- 数据库路径由 `DATABASE_PATH` 控制；测试不得误写用户默认数据库。
- 不提交 `database/*.db`、临时压缩库或用户备份。

### Schema 变更

本项目当前没有通用迁移框架。Schema 改动必须在设计中说明：

1. 新安装如何通过 `db.create_all()` 得到结构。
2. 已有便携数据库如何兼容或升级。
3. `to_sql(replace/append)` 与 ORM 主键/索引是否一致。
4. 是否需要一次性迁移；一次性本地脚本不要默认纳入 git。

不能机械套用“所有 Schema 变更都必须新增 Alembic migration”，也不能只验证空库后忽略已有数据库。

## 3. v2 原样导入

唯一业务导入入口是 `backend/processors/v2/raw_import.py`。支持类型以 `backend/routes/upload.py::DATA_TYPES` 与 `raw_import.HANDLERS` 的交集为准。

允许的格式层处理：

- `nan` / `None` / 空串安全转 NULL。
- 日期字段格式安全解析。
- 是/否、布尔和 0/1 的类型安全转换。
- 超过 SQLite INTEGER 安全范围的 ID 转字符串。
- 明确的无意义导出列处理，例如已存在的 `Unnamed` 列规则。

禁止：

- 新增下游业务 mapping、归一化、字段补全或漏斗计算。
- 恢复旧 v1 processor、旧表或迁移链路。
- 让查询层依赖导入时临时发明的业务字段。
- 未评估主键和批次语义就改变 replace / append 模式。

### 青鸟例外

`qingniao_leads` 使用 append 保留批次，并为每行添加 `批次标注`。修改时同时核对：

- `handle_qingniao_leads`。
- `write_to_db` 中的 append 分支。
- 上传路由的 `batch_tag` 透传。
- `FactQingniaoLeads` 模型和对账端点。
- 对账页面上传与批次选择行为。

## 4. 查询与 API

- API 前缀为 `/api/v1`，新增端点遵守现有蓝图分区。
- 查询端可做 SELECT、聚合、分组、排序、分页和兼容派生字段。
- 统一使用项目现有异常处理和响应结构，不在单个端点发明新的错误形态。
- 增加筛选参数时同步核对前端 filter adapter、service、类型、URL/请求体和空数组语义。
- 聚合比率必须显式处理分母为 0；金额和计数的 NULL 应通过 `coalesce` 或响应层安全转换。
- 日期字段在 SQLite 中多为文本时，保持项目现有的可排序格式和过滤方式。
- 修改应用市场、内容平台、直播或资产查询时必须遵守 `business-invariants.md`。
- 新增/修改 `@bp.route` 时，移动端/PWA 端的等价实现 `frontend-react/src/services/mobileRouteHandler.ts` 必须同步加 case（SQL 与后端完全一致），并跑 `python scripts/check_api_contract.py` 对账；详见 `cross-platform.md` 第 4.1 与 4.4 节。

### 兼容层

- `DoubleApiRewriteMiddleware` 是旧缓存 `/api/api/...` 的兼容层，删除前必须证明不再有旧客户端。
- SPA 兜底不能吞掉 API 404 或静态文件错误；修改 `serve_react_app` 时验证 API 与前端深链接。
- 已退役上传类型应继续返回 `410 Gone` 和迁移提示，而不是变成无法区分的 404/500。

## 5. 后台线程与子进程

- Flask 子线程不会自动继承 application context；使用数据库或应用配置时显式进入 `with app.app_context():`。
- 不在后台线程直接依赖 request context 或未经捕获的 `current_app`。
- 可用纯函数读取的信息（如 `version.json`、Git 命令）优先写成不依赖 Flask context 的助手函数。
- Windows 下非交互子进程使用 `creationflags=0x08000000` 避免闪出 cmd 黑窗。
- 启动后台进程时，只有用户需要交互窗口才显示；普通服务应隐藏窗口并记录 PID/日志。

## 6. 自更新与 Git

- `git pull` 前检查工作区 dirty 状态，不能覆盖用户改动。
- 只有明确 `force` 流程才可 stash；恢复失败或冲突时保留 stash 并向用户报告。
- Git 子进程结果以退出码和后续状态验证，不只依赖 stdout 文案。
- 自更新端点的网络、stash、pull、恢复和版本读取错误需要可区分响应。

## 7. WebDAV 与预留集成

- WebDAV 网络层错误（SSL、连接重置、拒绝、超时等）返回 `502`，错误码 `UPSTREAM_UNAVAILABLE`。
- 其他列表/业务失败返回 `500`，错误码 `LIST_FAILED` 或当前端点约定码。
- 不降低 `WEBDAV_VERIFY_SSL` 默认安全性；代理和证书行为由配置控制。
- 飞书相关环境变量目前是预留项，生产无同步路由消费；不要根据旧代码重新暴露接口。

## 8. 配置与敏感信息

- 新配置先加入 `.env.example` 和 `config.py`，提供安全默认值与类型转换。
- `.env` 永不提交，日志不得输出密码、token、WebDAV 凭据或完整敏感请求。
- 上传、日志、数据库目录由配置和启动逻辑创建；不要硬编码个人绝对路径。
- 只在确需 Windows 专属行为时写平台分支，并提供其他平台兜底。

## 9. 最小验证

| 改动 | 最小验证 |
| --- | --- |
| Python 规则/工具脚本 | `python -m py_compile <file>` |
| 后端查询、模型或路由 | `python -m unittest discover -s tests/api -v` |
| 新核心端点 | 在 `tests/api/test_smoke.py` 增加快速 smoke，再运行 API smoke |
| 启动、静态托管或中间件 | API smoke + 目标深链接/静态资源验证 |
| 导入行为 | 使用隔离数据库和最小样例验证目标表、行数、replace/append 语义 |
| WebDAV / 外部集成 | 对错误分类做隔离测试；不要在普通测试中依赖真实网络 |

完整验证与交付规则见 `testing-and-delivery.md`。

