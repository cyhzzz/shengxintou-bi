# 省心投 BI

> **版本**: v0.9.1
> **更新日期**: 2026-02-13
> **项目类型**: 广告投放数据分析平台

---

## 📋 项目简介

省心投 BI 是一个轻量级互联网广告投放分析平台，提供多平台广告数据聚合、分析和可视化功能。

### 核心特性

- **多平台数据整合**: 支持腾讯广告、抖音广告、小红书广告三大平台
- **账号代理商映射**: 手动管理各平台账号与代理商、业务模式的映射关系
- **日级趋势分析**: 按日期、平台、代理商、业务模式等多维度分析投放数据
- **灵活筛选**: 支持按平台、业务模式、代理商、日期范围筛选数据
- **独立筛选器**: 每个报表有独立的筛选器，互不干扰
- **模块化后端**: v0.9.1版本完成数据接口模块化重构，提升可维护性

### 技术栈

**后端**:
- Python 3.8+
- Flask 3.x (Web框架)
- SQLAlchemy 2.x (ORM)
- SQLite / MySQL / PostgreSQL (数据库)
- Pandas (数据处理)

**前端**:
- 原生 JavaScript (ES6+)
- ECharts 5.x (数据可视化)
- CSS3 + CSS Variables
- 组件化架构

**性能优化** (Phase 1-2 已完成):
- 后端: SQLite WAL模式、13个数据库索引、查询速度提升50%+
- 前端: ECharts延迟加载、异步瀑布流、初始加载减少30-40%

---

## 🚀 快速开始

### 环境要求

- Python 3.8 或更高版本
- 现代浏览器 (Chrome, Firefox, Edge, Safari, etc.)
- 约 100MB 可用磁盘空间

### 安装步骤

1. **克隆项目**
   ```bash
   git clone https://github.com/cyhzzz/shengxintou-bi.git
   cd shengxintou-bi/开发代码
   ```

2. **安装依赖** (如需单独安装)
   ```bash
   pip install -r requirements.txt
   ```

3. **配置环境** (可选)
   ```bash
   # 复制配置文件
   cp .env.example .env

   # 编辑配置
   # 设置数据库路径、API密钥等
   ```

4. **初始化数据库**
   ```bash
   python init_db.py
   ```

5. **启动应用**
   ```bash
   # Linux/MacOS
   python app.py

   # Windows
   python app.py
   或双击 `省心投启动器.exe`
   ```

6. **访问应用**
   ```
   打开浏览器访问: http://127.0.0.1:5000
   ```

### 便携版启动（推荐）

双击 `省心投启动器.exe` 即可自动：
- 检查Python环境
- 启动Flask服务器
- 打开浏览器

**无需安装Python环境**

---

## 📂 项目结构

```
开发代码/
├── app.py                  # Flask 应用入口
├── config.py               # 配置文件
├── launcher.py             # 启动器源码
├── version.json             # 版本信息
├── favicon.ico            # 网站图标
├── 使用说明.txt            # 用户使用指南
│
├── 【后端代码】
├── backend/                # 后端代码
│   ├── __init__.py        # 后端初始化
│   ├── database.py          # 数据库配置
│   ├── models.py            # 数据库模型（15张表）
│   ├── routes/              # API 路由
│   │   ├── data/          # 数据查询接口
│   │   │   ├── __init__.py
│   │   │   ├── query.py (490行)
│   │   │   ├── dashboard.py (465行)
│   │   │   ├── trend.py (162行)
│   │   │   ├── agency_analysis.py (268行)
│   │   │   ├── xhs_notes.py (414行)
│   │   │   ├── cost_analysis.py (309行)
│   │   │   ├── external_analysis.py (357行)
│   │   │   ├── leads.py (341行)
│   │   │   ├── account_mapping.py (316行)
│   │   │   └── abbreviation_mapping.py (240行)
│   │   └── upload.py        # 文件上传接口
│   ├── scripts/              # 数据处理脚本
│   │   └── aggregations/  # 数据聚合脚本
│
├── 【前端代码】
├── frontend/              # 前端代码
│   ├── index.html         # 主页面
│   ├── css/              # 样式文件
│   │   ├── variables.css    # CSS变量
│   │   ├── layout.css       # 布局样式
│   │   └── components.css  # 统一组件系统
│   ├── js/               # JavaScript 文件
│   │   ├── main.js          # 应用入口
│   │   ├── utils/           # 工具函数
│   │   ├── components/       # UI组件
│   │   └── reports/          # 报表组件
│
├── 【数据目录】
│   ├── database/             # SQLite数据库文件
│   └── uploads/              # 文件上传目录
│
└── 【其他】
    ├── docs/                # 技术文档
    ├── icon/                # 图标资源
    └── logs/                # 日志文件
```

### 核心文档

| 文档 | 说明 |
|------|------|
| [CLAUDE.md](.claude/rules/) | AI开发指南和项目规则 |
| [数据库架构文档](开发代码/docs/数据库架构文档.md) | 完整数据库表结构（15张表）|
| [前端设计规范](.claude/rules/frontend-design/) | 前端组件和样式规范 |
| [API接口规则](.claude/rules/api-rules.md) | 后端API设计规范 |

---

## 🎯 功能模块

### 报表菜单

| 菜单项 | 功能说明 | 状态 |
|---------|---------|------|
| 数据概览 | 整体数据概览，展示核心指标和趋势 | ✅ |
| 厂商分析 | 代理商投放和转化数据分析 | ✅ |
| 小红书报表 | 笔记列表、运营分析、创作分析 | ✅ |
| 线索明细 | 所有客户线索到转化的数据明细 | ✅ |
| 转化漏斗 | 从转化率角度针对性查看和分析 | ✅ |
| 报告生成 | 生成符合格式的可视化周报、月报 | 🚧 |
| 配置管理 | 数据导入、账号管理等配置功能 | ✅ |

### 数据平台支持

| 平台 | 支持功能 |
|------|----------|
| **腾讯广告** | 日级花费、曝光、点击数据导入与分析 |
| **抖音广告** | 日级消耗、展示数、点击数、转化数据导入与分析 |
| **小红书广告** | 广告数据、笔记投放、运营数据导入与分析 |
| **后端转化** | 线索、开户、资产等转化数据导入与分析 |

---

## 🔧 开发指南

### 本地开发

1. **克隆代码**
   ```bash
   git clone https://github.com/cyhzzz/shengxintou-bi.git
   cd shengxintou-bi/开发代码
   ```

2. **安装依赖**
   ```bash
   pip install -r requirements.txt
   ```

3. **启动开发服务器**
   ```bash
   # 设置开发模式
   export DEV_MODE=1

   # 启动服务器
   python app.py

   # 访问 http://127.0.0.1:5000
   ```

### 代码规范

遵循以下规范进行开发：

- **后端开发**: [.claude/rules/backend-standards.md](.claude/rules/backend-standards.md)
- **前端开发**: [.claude/rules/frontend-design/](.claude/rules/frontend-design/)
- **API设计**: [.claude/rules/api-rules.md](.claude/rules/api-rules.md)
- **数据处理**: [.claude/rules/data-rules.md](.claude/rules/data-rules.md)

### Git 工作流

```bash
# 创建功能分支
git checkout -b feature/new-feature

# 提交更改
git add .
git commit -m "feat: 添加新功能描述"

# 推送到远程
git push origin feature/new-feature
```

---

## 📊 版本历史

### 当前版本

**v0.9.1** (2026-02-13)
- 🎉 **后端架构重构**: data.py拆分为18个模块文件
  - 单文件行数从3996行降至平均232行
  - 26个API接口100%保留功能
  - 100%向后兼容，无需修改前端代码
- 📦 新增文档：拆分报告、使用指南、验证指南
- ⚡ 性能优化：模块化加载，减少代码冲突

### 历史版本

| 版本 | 日期 | 说明 |
|-------|------|------|
| v0.9.0 | 2026-02-05 | 首个完整版本，制作exe启动器 |
| v0.8.0 | - | 早期版本 |

查看完整版本历史：[版本输出/](版本输出/)

---

## 🐛 常见问题

### 启动相关

**Q**: 双击启动器无反应？
- 检查是否有杀毒软件拦截
- 以管理员身份运行

**Q**: 浏览器无法打开？
- 手动访问 http://127.0.0.1:5000
- 检查服务器是否正常启动

**Q**: 端口5000被占用？
- 关闭占用端口的程序
- 按 `Ctrl+C` 停止服务器后重新启动

### 数据导入

**Q**: 导入数据后报表不显示？
- 确认数据导入成功
- 刷新浏览器页面 (Ctrl+F5)
- 检查浏览器控制台是否有错误

**Q**: 筛选器不生效？
- 点击"查询"按钮执行筛选
- 检查筛选条件是否正确

### 数据库

**Q**: 如何备份数据？
- 数据库文件: `database/shengxintou.db`
- 直接复制该文件即可

**Q**: 如何重置数据库？
- 删除数据库文件，重启应用会自动创建

---

## 📞 技术支持

- **文档**: [CLAUDE.md](.claude/rules/) - 开发指南和项目规则
- **问题反馈**: GitHub Issues
- **联系方式**: 产品经理 陈元昊

### 相关链接

- **项目地址**: https://github.com/cyhzzz/shengxintou-bi
- **省心投BI系列**: 其他相关项目

---

## 📄 许可证

本项目仅供学习和个人使用。请遵循相关法律法规和平台使用协议。

---

**最后更新**: 2026-02-13
**维护者**: Claude AI
