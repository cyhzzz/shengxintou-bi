# 省心投 BI

券商财富管理场景下的互联网广告投放 + 开户转化数据分析平台。覆盖**内容平台**（抖音 / 腾讯 / 小红书 / 快手）与**应用市场**（小米 / 华为 / OPPO / VIVO / 荣耀 / 苹果）两大类渠道，从广告投放、线索获取、私域转化到开户成功的全链路数据分析与可视化。

定位：**数据存储 + 查询聚合 + 可视化呈现**。原始数据的 mapping / 清洗 / 归一化 / 漏斗预计算由上游 ETL 完成，下游仅原样入库 + SELECT 聚合 + 报表展示。

---

## 核心能力

### 双链路独立漏斗
- **内容平台漏斗**：`广告曝光 → 客户点击 → 客户线索 → 客户开口 → 有效线索 → 成功开户 → 有效户`（7 阶段，数据源 `fact_conv_content`）。
- **应用市场漏斗**：`激活 APP → 开户成功 → 入金 → 有效户` 等 8 阶段（数据源 `fact_conv_appmarket`）。
- 顶部筛选器：日期范围 + 平台多选（小红书 / 腾讯 / 抖音 / 快手 + 小米 / 华为 / OPPO / VIVO / 荣耀 / 苹果）。

### 全渠道获客概览
- 跨渠道类别（合作机构 / 自然流入 / 员工开户 / 互联网引流）+ 跨平台聚合。
- KPI 完成率（年度 KPI 开 2 万户 / 1 万有效户，按 `dayOfYear / 366` 时间折算）。
- 顶部 4 张 `MetricCard` + 4 Tab 详情表 + 日趋势 + **互联网渠道日历热力图**（过去 365 天每日开户密度，蓝色 5 档 `l0..l4`）。

### 应用市场专项
- 4 子页：漏斗 / 对比 / 明细 / 创意。
- 设备明细支持行点击详情浮窗（`Modal + Descriptions column={2}`），参考 `LeadsDetail` 模式。

### 转化漏斗 + 线索明细
- 双漏斗并行（内容 + 应用市场），KPI 卡从 `客户线索` 起步。
- 线索明细支持详情浮窗，列名 1:1 对齐 `fact_conv_content` 表。

### 主播分析（直播获客）
- 同名主播跨平台前端聚合（`platforms / leads / mouth / valid_lead / opened / valid / assets / sources`）。
- 总创收资产 = 仅累加 `opened > 0` 行的 `assets`（"总创收资产（仅开户）"）。
- 覆盖平台用 `<Tag color=cyan>` 去重展示。
- 顶部 `平台` + `主播` 双 `Select` 筛选器，`pagination={false}` 一页呈现。

### 小红书笔记
- 笔记列表 + 运营分析。
- 默认按 `开户人数 desc` 排序（白名单字段，避免 2246 行 =0 把 93 行有数笔记埋没）。
- 4 个枚举筛选器 `{value, label}[]` object array（修复 antd `in` operator 报错）。

### 厂商分析 + 员工转化
- 代理商投放对比 + 自有员工开户与企微转化双口径分析。
- 员工转化双源对比（`detail_caliber` / `channel_caliber`）独立标注。

### 数据导入与新鲜度
- 6 个 v2 数据导入类型：`account_mapping / conversion_content / conversion_appmarket / vendor_daily / xhs_note / channel_open`。
- 数据源自省心投系统（公司内网站）导出，二次导入分析；每个指南首行指明精确段位（`投放账号映射 → 1000.7`、`小红书笔记 → 6.1` 等）。
- 数据新鲜度一屏可查（`/api/v1/data-freshness` 返回 5 张新表 `critical / warning / normal` 状态）。

### 备份与错误粒度
- 数据库自动备份到坚果云 WebDAV（保留最近 N 个 + 可选压缩）。
- 错误粒度：网络层（SSL / 连接被重置 / 拒绝）→ **502 + UPSTREAM_UNAVAILABLE**；其它异常 → 500 + LIST_FAILED。

### 设计统一
- 公共 `MetricCard` + `MetricSection` 组件（响应式 4/3/2/1）。
- 设计 token 体系（日/夜主题、品牌色、间距、圆角、阴影、功能色、图表色板）。
- `ReportFooter` 底部弱化区集中展示 **数据源 / 端点 / 口径说明**。
- `sanitizeText` 客户端文本清洗（剥 NUL / 控制字符 / `�` / 零宽）。
- `FunnelChart` 基于 `@ant-design/plots` Funnel + `ErrorBoundary` CSS 横条降级。

---

## 技术栈

- **后端**：Python Flask + SQLAlchemy + SQLite + pandas 原样导入（`to_sql(replace)`）。
- **前端**：React 19 + TypeScript + Vite + Ant Design 5/6 + @ant-design/plots / @ant-design/charts + ECharts + Zustand。
- **数据库**：SQLite（默认）/ 可切换 MySQL / PostgreSQL。
- **架构原则**：本项目只做数据存储 + 可视化呈现；mapping / 清洗 / 预计算由上游 ETL 完成。

---

## 快速开始

### 环境要求

- Python 3.9 或更高版本
- Node.js 18 或更高版本

### 后端启动

```powershell
# 安装依赖
pip install -r requirements.txt

# 开发模式（5000 端口 Flask）
$env:DEV_MODE='1'; python app.py

# 重置数据库：删 database/shengxintou.db 后重启 Flask
```

### 前端启动

```powershell
cd frontend-react
npm install
npm run dev          # Vite dev server :3000，自动代理 /api -> :5000
npm run build        # tsc 类型检查 + vite build，产物到 dist/
npm run preview
```

### 端到端测试

```powershell
cd frontend-react
npm run test
npm run test:headed
npm run test:report  # 打开 HTML 报告
```

> 生产前端没看到最新代码时 = `dist` 没构建，跑一次 `npm run build` 即可（5000 端口不需要重启 Flask，dist 文件被即时读取）。

---

## 目录结构

```
D:/AIproject/省心投BI/
├── app.py                          # Flask 入口
├── config.py                       # 配置（DB / WebDAV / 飞书）
├── requirements.txt
├── .env.example                    # 环境变量示例
├── backend/
│   ├── models.py / models_v2.py    # 9 张新表 ORM（列名 1:1 含中文）
│   ├── routes/                     # API 蓝图（upload / metadata / data / reports / webdav）
│   ├── processors/v2/              # v2 原样导入（pandas to_sql replace）
│   └── utils/                      # 装饰器 / WebDAV 客户端 / 飞书同步
├── database/shengxintou.db         # SQLite（默认）
├── frontend-react/
│   ├── src/
│   │   ├── components/             # MetricCard / ReportFooter / Chart / GuideModal / Icon
│   │   ├── pages/                  # Dashboard / OmniChannel / ConversionFunnel / AnchorCluster 等
│   │   ├── services/               # http / dataService / uploadService
│   │   ├── stores/                 # zustand 状态管理
│   │   ├── styles/                 # tokens.css / mixins.scss / variables.scss
│   │   └── types/                  # orval 生成的 api.ts
│   └── public/documents/           # 6 个 v2 数据导入指南 .md
└── docs/
    ├── v3.1_报表重梳方案.md
    ├── 库表重构设计_v3.md
    ├── 前端UI优化规划PRD.md
    └── ...
```

---

## 文档索引

- `AGENTS.md` / `CLAUDE.md`：项目工作说明（项目规则 + 修改守则 + 关键架构）。
- `docs/v3.1_报表重梳方案.md`：v3.1 菜单 / 双漏斗 / 双源 / 应用市场 / 直播占位设计。
- `docs/库表重构设计_v2.md` / `docs/库表重构设计_v3.md`：DIM/DWD/DWS 表设计。
- `docs/前端UI优化规划PRD.md`：v3.1.1 设计 token / 日夜模式 / 样式治理规划。
- `docs/数据库架构文档.md`：13 表说明（历史，新代码以 v2/v3 重构文档为准）。
- `docs/部署指南.md`：开发、生产、Docker、性能优化、监控与故障排查。

---

## 联系

- 维护：产品经理 陈元昊
- 仓库：`https://github.com/cyhzzz/shengxintou-bi`
