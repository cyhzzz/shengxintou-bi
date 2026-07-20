# 前端开发规则

## 1. 架构边界

- 页面放在 `frontend-react/src/pages/`，通过 `src/router/index.tsx` lazy 加载。
- 可复用展示逻辑放 `src/components/`；页面不要复制已有公共组件。
- API 调用放 `src/services/`，共享状态放 `src/stores/`，数据适配与纯函数放 `src/utils/`。
- 全局设计 token 在 `src/styles/tokens.css` / `variables.scss` 等权威文件维护，页面样式优先复用 CSS 变量。
- 生成 API 文件 `frontend-react/src/types/api.ts` 禁止手改；通过 `npm run generate:api` 重新生成。
- `api.schemas.ts` 和业务类型只有在确认不是生成覆盖目标后才能手工维护。

### `/metadata` 端点类型契约

- `platforms` 和 `business_models` 字段是 `string[]`，前端 service 直接 `.map((s: string) => ({ value: s, label: s }))` 转 `Select` 选项。
- 不要在后端改成 `[{value, label}]` 对象数组，也不要在前端对返回值再加一层 `.map((p: any) => ({...}))` 转换，否则选项会变成 `[object Object]`。
- `agencies` 字段是 `[{value, label, full_names}]` 对象数组，与 `platforms` / `business_models` 不同。

## 2. 报表统一组件

### 指标卡

- 报表头部指标一律使用 `MetricCard` + `MetricSection`。
- 禁止在页面中重新实现 `Card + Row/Col` 指标卡组。
- 现有例外：小红书运营报表的特殊设计块和 Employee Conversion Weekly 周报海报子系统。
- 指标卡 description 只解释指标本身，不塞入数据源、端点和长口径说明。

### 报表脚注

- 数据源、端点、筛选口径、计算说明和备注统一进入 `ReportFooter`。
- 同一说明不要在筛选卡、MetricCard 和页脚重复三遍。

### 漏斗

- 使用 `FunnelChart`，保留 Ant Design Plots 主实现和 ErrorBoundary CSS 横条降级。
- 数据进入图表前只保留有限数值：`typeof count === 'number' && Number.isFinite(count)`。
- 对数尺度只改变视觉宽度，tooltip、表格和指标仍显示原始值。
- 修改漏斗阶段前先读 `business-invariants.md`，前端不能通过过滤重写后端口径。

## 3. 表格和详情

- Ant Design `Table` 的业务列必须设置正确的 `dataIndex` / `key`。
- 若缺少 `dataIndex`，`render(value)` 可能收到整行对象，布尔列会因对象恒 truthy 全显示“是”。
- 行级设备/线索数据应提供详情浮窗，遵循 `Modal + Descriptions column={2}` 的既有模式。
- 大表明确设置横向滚动、列宽、固定列和稳定 `rowKey`。
- 主播聚合表按产品要求一页呈现时使用 `pagination={false}`。
- 导出数据和页面展示使用同一筛选结果与口径，不能导出未筛选原始数组。

## 4. 文本、日期和脏数据

- 展示 Excel 导入的主播名、来源、备注、昵称等文本前使用 `sanitizeText()`。
- 不在页面内复制字符清洗正则；扩展清洗规则时修改共享工具并验证调用方。
- 构造业务本地日期字符串时不要使用 `toISOString().slice(0, 10)`；东八区会在部分时刻得到 UTC 前一天。
- 使用 `getFullYear()`、`getMonth()`、`getDate()` 组装本地日期，或使用项目已有 dayjs 方式。
- 纯文件名时间戳若明确需要 UTC 可以使用 `toISOString()`，不要把该例外带入业务筛选日期。

## 5. React 与 TypeScript 安全检查

- 新增 Ant Design 组件或图标后立即核对 import；JSX 可编译但缺运行时标识会产生 `ReferenceError`。
- `onClick`、`onChange` 等回调引用的函数必须在同作用域定义，名称与实际函数一致。
- 避免 const/let 暂存死区；状态、memo、callback 和内部函数按依赖顺序声明。
- Vite HMR 异常时先刷新/rebuild，再判断依赖版本；不要用依赖降级掩盖作用域或 BOM 问题。
- 文件使用 UTF-8；出现模块导出异常时检查 BOM、NUL 和替换字符。
- 不用 `any` 绕过可表达的 API 类型；边界响应若确实不稳定，在 service/mutator 层集中适配。
- Orval 双层响应包装的兼容处理集中在现有 mutator 和共享类型，不在页面重复断言链。

## 6. 布局与样式

- 页面外层间距由 `MainLayout` / ConfigProvider 统一提供，报表 `.page` 不重复增加 padding。
- 侧栏使用 flex 布局，菜单容器 `overflow-y: auto`；不要把实际滚动容器改成 `overflow: hidden`。
- `body` / `#root` 保持固定视口，主内容区域负责滚动；修改前核对 `global.scss` 和 `MainLayout.module.scss`。
- 自定义颜色、间距、圆角、阴影和动效使用项目 token，不新增散落的近似硬编码值。
- 动效优先修改 `transform` / `opacity`，遵守 `prefers-reduced-motion`，避免触发布局抖动。
- 不用全局选择器修复单页问题，除非该行为确实是全站规范。

## 7. 指南与静态内容

- 当前 `GuideModal` 使用内置 `GUIDE_CONTENTS`，不是运行时 fetch Markdown；修改前先读当前组件，不套用旧版 fetch 规则。
- 增加标准数据导入类型时同步核对：后端 `DATA_TYPES`、前端 `DataType`/`DATA_TYPES`、上传 service、GuideModal 标题与内容、公开指南、README 和 smoke。
- 若未来恢复 fetch Markdown，必须校验响应状态和 `content-type: text/markdown`，防止 Flask SPA 兜底的 `index.html` 被当作 Markdown 渲染。
- 静态指南与内置内容只能指定一个用户侧权威来源；不能长期维护两套互相冲突的正文。

## 8. 路由与菜单

- 新 lazy 页面同时更新 router 和 MainLayout 菜单/面包屑（若对用户可见）。
- 保持旧路由重定向时，明确迁移目标，不让旧链接进入空白页面。
- 路由新增或修改后更新 `frontend-react/tests/smoke/route-health.spec.ts`。
- `withSuspense` 负责统一 Suspense 和错误边界；通用页面通过 props 复用时避免重复 lazy import。

## 9. 业务数据展示

- 新开户、存量客户、应用市场互联网引流和主播类型规则见 `business-invariants.md`。
- 前端不得通过“为了图表好看”截断、排序后丢失或重新归类业务数据。
- 金额、比率和人数的分母为 0 时展示约定值或 `-`，不要产生 `Infinity` / `NaN`。
- 同名主播跨平台聚合时集合字段去重，数值字段按后端语义求和。
- ReportFooter 要说明后端源表和口径，但不复制版本 changelog。

## 10. 最小验证

| 改动 | 最小验证 |
| --- | --- |
| TS/TSX、service、store、类型 | `cd frontend-react && npm run typecheck` |
| React 页面/组件/样式 | typecheck + `npm run build` |
| lint 相关或大范围重构 | `npm run lint` |
| 路由/lazy 页面 | `npm run test:smoke` |
| Bug 修复 | 对应 `npm run test:regression` 用例或定向 Playwright spec |
| 发版前页面行为 | `npm run test:functional`，仅发版或明确要求时执行 |

从最相关的检查开始，再按风险扩展。构建成功不能替代行为测试，Playwright 通过也不能替代 TypeScript 检查。

