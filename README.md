# 省心投 BI

> **版本**: v3.1.1
> **更新日期**: 2026-07-10
> **项目类型**: 券商互联网广告投放数据分析平台

---


---

## 🚀 最新版本 v3.1.1（2026-07-10）

本次更新重点是前端 UI 统一化与主题能力接入，后端表与路由未变动：

- **指标卡组件抽出**：新增 `components/MetricCard/`（MetricCard + MetricSection），所有报表头部数据卡片统一调用，与互联网渠道数据概览保持一致。
- **设计 token 体系**：新增 `styles/tokens.css`（品牌色 / 间距 / 圆角 / 阴影 / 字体 / 功能色 / 图表色板，日夜间变量）与 `styles/mixins.scss`（card-section-header / filter-bar / text-ellipsis / card-base）。
- **日/夜主题**：顶部 Header 提供切换入口，`useAppStore.themeMode` 持久化到 localStorage；Ant Design ConfigProvider 动态切换 defaultAlgorithm / darkAlgorithm。
- **报表头部统一**：互联网渠道数据概览 / 全渠道获客 / 转化漏斗 / 厂商分析 / 应用市场漏斗 / 应用市场创意效果 / 直播漏斗 / 主播聚类 8 个报表都走 MetricSection 4/3/2/1 响应式。
- **文档同步**：`AGENTS.md` 与 `CLAUDE.md` 重写到 v3.1.1 状态，字节完全一致（SHA256 验证）。

---

## 📋 项目简介

省心投 BI 是面向券商财富业务互联网拓客的数据分析平台，覆盖**内容平台**（抖音 / 腾讯 / 小红书 / 快手）与**应用市场**（小米 / 华为 / OPPO / VIVO / 荣耀 / 苹果，鸿蒙 / iOS 待上线）两大类渠道，提供从广告投放、线索获取、私域转化到开户成功的全链路数据分析与可视化。

### 核心特性

- **双链路漏斗**: 内容平台「广告 → 企微 → 私域 → 开户」与 应用市场「广告 → APP 下载 → 开户链路 → 开户成功」两套独立漏斗
- **应用市场专项**: 独立报表模块（漏斗 / 对比 / 明细 / 创意），数据源与内容平台分离
- **全渠道获客报表**: 跨平台、跨厂商、跨业务模式的统一投放与转化概览
- **维度 / 明细 / 聚合三层模型**: 9 张新表（DIM + DWD + DWS），原样入库、查询展示，不做二次 mapping
- **小红书笔记分析**: 笔记列表与运营分析
- **员工转化**: 自有员工开户与企微转化双口径分析
- **数据新鲜度**: 各数据源更新时间一屏可查

### 技术栈

**后端**:
- Python 3.9+（开发环境 3.13 可用）
- Flask（Web 框架）+ SQLAlchemy（ORM）
- SQLite（默认）/ 可切换 MySQL / PostgreSQL
- Pandas（数据导入）

**前端**:
- React 19 + TypeScript
- Vite（构建 / 开发服务器）
- Ant Design（组件库）
- ECharts（数据可视化）

**架构原则**: 本平台**只做数据存储 + 可视化呈现**。原始数据的清洗、规范化、字段补全、漏斗预计算均由上游 ETL 完成，下游仅原样入库 + 查询 + 展示。

---

## 🚀 快速开始

### 环境要求

- Python 3.9 或更高版本
- Node.js 18+（前端开发）
- 现代浏览器（Chrome / Edge / Firefox / Safari）

### 源码方式运行

1. **克隆项目**
   ```bash
   git clone git@github.com:cyhzzz/shengxintou-bi.git
   cd shengxintou-bi
   ```

2. **安装后端依赖**
   ```bash
   python -m venv .venv
   .venv\Scripts\activate        # Windows
   pip install -r requirements.txt
   ```

3. **配置环境**
   ```bash
   cp .env.example .env
   # 编辑 .env：设置数据库连接、坚果云 WebDAV 备份、飞书同步等
   ```

4. **启动后端**（默认 :5000）
   ```bash
   # 开发模式（标准 Flask，跳过 pywebview 桌面壳）
   DEV_MODE=1 python app.py
   ```

5. **启动前端**（默认 :3000，自动代理 /api → :5000）
   ```bash
   cd frontend-react
   npm install
   npm run dev
   ```

6. **访问应用**
   ```
   浏览器打开: http://127.0.0.1:3000
   ```

### 便携版启动（推荐）

双击 `省心投启动器.exe` 即可在便携环境中一键启动（内置 Python 与依赖，无需安装环境）：
- 检查运行环境
- 启动 Flask 服务器
- 自动打开浏览器

生产构建（生成 `frontend-react/dist/`，由 Flask 托管）：
```bash
cd frontend-react && npm run build
```

---

## 📂 项目结构

```
省心投BI/
├── app.py                  # Flask 应用入口（DEV_MODE 切换桌面壳）
├── config.py               # 配置（API 前缀 / 飞书 / WebDAV / 数据库路径）
├── version.json            # 版本信息
├── 省心投启动器.exe         # 便携版启动器（随版本发布）
├── 省心投启动器.spec        # PyInstaller 打包配置
│
├── backend/                # 后端代码
│   ├── models.py           # 系统表 ORM（导入日志 / 配置 / 周报）
│   ├── models_v2.py        # ✅ 9 张新表 ORM（DIM/DWD/DWS，列名含中文）
│   ├── database.py         # SQLAlchemy 单例
│   ├── processors/v2/      # v2 原样导入（pandas to_sql，无业务计算）
│   ├── routes/
│   │   ├── data/           # 13 个查询蓝图（全部查新表）
│   │   ├── reports/        # v3.1 新增：omni_channel / app_market 报表
│   │   ├── upload.py       # 上传入口（仅识别 6 个新数据类型）
│   │   ├── metadata.py     # 元数据 + 数据新鲜度
│   │   ├── webdav_backup.py# 坚果云备份
│   │   └── weekly_reports.py
│   └── utils/
│
├── frontend-react/         # 前端代码（React 19 + TS + Vite + AntD）
│   ├── src/pages/          # 顶级页面
│   ├── src/components/     # 图表 / 筛选 / 数据新鲜度 等组件
│   ├── src/services/       # HTTP 客户端 / dataService / 上传
│   ├── src/stores/         # zustand 全局状态
│   └── src/router/         # 路由（含旧路径 redirect）
│
├── docs/                   # 技术文档（库表重构设计 / v3.1 报表重梳设计 等）
├── scripts/                # 数据处理 / ETL 脚本
├── tests/                  # 测试
├── database/               # SQLite 数据库文件（不入库，本地数据）
├── uploads/                # 用户上传目录（不入库）
├── logs/                   # 日志目录（不入库）
└── 数据源/                 # 原始 Excel 数据源（不入库）
```

### 核心文档

| 文档 | 说明 |
|------|------|
| [AGENTS.md](AGENTS.md) | AI 开发指南与项目规则（战略方向 / 架构 / 命令） |
| [docs/库表重构设计_v2.md](docs/库表重构设计_v2.md) | v2 九表库表设计（DIM/DWD/DWS） |
| [docs/v3.1_报表重梳设计.md](docs/v3.1_报表重梳设计.md) | v3.1 报表菜单与页面重梳设计 |

---

## 🎯 功能模块

### 报表菜单

| 菜单项 | 功能说明 | 状态 |
|---------|---------|------|
| 全渠道获客 | 跨平台 / 厂商 / 业务模式统一概览 | ✅ |
| 互联网渠道数据概览 | 各渠道投放与转化日级概览 | ✅ |
| 转化漏斗 | 双漏斗：内容平台 + 应用市场 | ✅ |
| 线索明细 | 客户线索到转化明细（fact_conv_content） | ✅ |
| 厂商分析 | 代理商投放与转化分析（agg_vendor_daily） | ✅ |
| 小红书 | 笔记列表 / 运营分析（agg_xhs_note） | ✅ |
| 应用市场 | 漏斗 / 对比 / 明细 / 创意（fact_conv_appmarket） | ✅ |
| 员工转化 | 分析 / 周报（双源） | ✅ |
| 直播获客 | 占位页（v3.2 接入） | 🚧 |
| 报告生成 | 可视化周报 / 月报 | ✅ |
| 系统配置 | 数据导入 / 账号管理 / 缩写管理 / 数据库备份 | ✅ |

### 数据平台支持

| 类别 | 渠道 |
|------|------|
| **内容平台** | 抖音、腾讯、小红书、快手（加微链路：广告 → 企微 → 私域 → 开户） |
| **应用市场** | 小米、华为、OPPO、VIVO、荣耀、苹果（下载链路：广告 → APP 下载 → 开户 → 开户成功） |
| **其他渠道** | 员工开户、合作机构、自然流入（见 agg_daily_channel_open） |

---

## 🔧 开发指南

### 本地开发

```bash
# 后端（另开终端）
DEV_MODE=1 python app.py            # http://127.0.0.1:5000

# 前端（另开终端）
cd frontend-react && npm run dev    # http://127.0.0.1:3000
```

### 代码规范与架构

- **后端分层**: M（models_v2 新表 ORM）/ Q（routes/data、routes/reports 查询蓝图）/ V（前端）
- **战略方向**: 只做存储 + 可视化，mapping / 清洗 / 预计算交给上游 ETL；新数据类型走 v2 原样导入
- **端点兼容**: v2 重构后 13 个查询端点路径零变动，内部改查新表，前端零改动对接
- **前端类型**: `src/types/api.ts` 由 orval 基于 openapi 生成，勿手改（`npm run generate:api`）

### Git 工作流

```bash
git checkout -b feature/new-feature
git add .
git commit -m "feat: 添加新功能描述"
git push origin feature/new-feature
```

---

## 📊 版本历史

### 当前版本

**v3.1.0** (2026-07-09)
- 🎉 **报表重梳**: 顶级菜单重构，应用市场独立成模块，新增全渠道获客报表
- 🎯 **双转化漏斗**: 内容平台（7 阶段）+ 应用市场（8 阶段）分离呈现
- 🧹 **清理历史包袱**: 删除旧原生 JS 前端、旧迁移脚本、遗留文档与调试脚本
- 📦 便携版启动器随版本发布

### 历史版本

| 版本 | 日期 | 说明 |
|-------|------|------|
| v2.1 | 2026-07 | 应用市场专项 + 全渠道获客报表 + AgencyAnalysis 去重 + AntD 弃用清理 |
| v2.0 | 2026-07 | 库表重构：9 张新表 + 全路由改写 + 前端字段适配 |
| v1.0 | 2026-03 | 前端架构迁移至 React + TypeScript + Vite |
| v0.9.1 | 2026-02 | 后端模块化重构（data.py 拆分） |

---

## 🐛 常见问题

### 启动相关

**Q**: 双击启动器无反应？
- 检查是否有杀毒软件拦截
- 以管理员身份运行

**Q**: 浏览器无法打开？
- 手动访问 http://127.0.0.1:5000
- 检查服务器是否正常启动

**Q**: 端口 5000 被占用？
- 关闭占用端口的程序后重新启动

### 数据相关

**Q**: 数据库文件在哪？
- `database/shengxintou.db`（本地数据，**不入库**）

**Q**: 如何备份数据？
- 系统配置 → 数据库备份，推送到坚果云 WebDAV；或直接复制 `.db` 文件

**Q**: 如何重置数据库？
- 删除数据库文件，重启应用会自动创建空库（需重新导入数据）

---

## 📞 技术支持

- **文档**: [AGENTS.md](AGENTS.md) - 开发指南和项目规则
- **问题反馈**: GitHub Issues
- **联系方式**: 产品经理 陈元昊

### 相关链接

- **项目地址**: https://github.com/cyhzzz/shengxintou-bi

---

## 📄 许可证

本项目仅供学习和个人使用。请遵循相关法律法规和平台使用协议。

---

**最后更新**: 2026-07-09
**维护者**: 产品经理 陈元昊
