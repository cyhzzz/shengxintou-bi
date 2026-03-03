# FICC Brain 项目规则

## 项目概述

FICC Brain 是银行金融市场部门智能分析平台（MVP），涵盖债券、外汇、贵金属、利率衍生品等业务线的风险、损益与绩效分析。项目包含债券业务、债券借贷、基金业务、回购业务、外汇业务、贵金属业务、黄金租借、利率衍生品、风险管理、RAROC & EVA 分析、营业费用分析、资产减值损失分析、交易员考核调整等核心功能。

## 技术栈

### 前端
- **框架**: Next.js 15 (React 19) - App Router
- **UI组件**: Ant Design 5.x
- **图表**: AntV G2/G6 (@ant-design/charts)
- **状态管理**: Zustand
- **数据获取**: TanStack Query (@tanstack/react-query)
- **样式**: Tailwind CSS 4.x + CSS Variables
- **语言**: TypeScript 5.x

### 后端
- **框架**: FastAPI
- **数据库**: SQLite (开发) / PostgreSQL (生产)
- **ORM**: SQLAlchemy
- **数据处理**: Pandas, NumPy
- **异步任务**: Celery + Redis
- **语言**: Python 3.11+

## 开发命令

### 前端 (在 ficc-brain/frontend 目录下)
```bash
npm run dev      # 启动开发服务器 (http://localhost:3000)
npm run build    # 构建生产版本
npm run start    # 启动生产服务器
npm run lint     # 运行 ESLint 检查
```

### 后端 (在 ficc-brain/backend 目录下)
```bash
# 激活虚拟环境
.\venv\Scripts\activate  # Windows
source venv/bin/activate  # Mac/Linux

# 启动开发服务器
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# 启动 Celery Worker (异步任务)
celery -A tasks worker --loglevel=info
```

### 一键启动
```bash
# Windows
.\setup.bat    # 首次安装
.\start.bat    # 启动服务

# Mac/Linux
./setup.sh     # 首次安装
./start.sh     # 启动服务
```

## 代码风格规范

### TypeScript/React
- 使用 `'use client'` 指令标记客户端组件
- 组件使用函数式组件和 Hooks
- 使用 Ant Design 组件库，避免自定义基础组件
- 图表使用 @ant-design/charts 或 AntV G2/G6
- 样式使用内联 style 或 Tailwind CSS 类
- 路径别名: `@/*` 映射到 `./src/*`

### Python
- 使用中文注释和文档字符串
- 遵循 PEP 8 规范
- 使用 Pydantic 进行数据验证
- API 路由使用 FastAPI Router 模块化
- 使用 SQLAlchemy ORM 进行数据库操作
- 使用 Pandas/NumPy 进行数据分析

### 命名规范
- 组件文件: PascalCase (如 `Dashboard.tsx`)
- 工具函数: camelCase
- Python 文件: snake_case (如 `dashboard.py`)
- CSS 类名: kebab-case
- 数据库表名: snake_case (如 `pnl_daily`)

## 项目结构

```
ficc-brain/
├── backend/
│   ├── api/v1/          # API 路由模块
│   │   ├── dashboard.py
│   │   ├── bonds.py
│   │   ├── funds.py
│   │   ├── repo.py
│   │   ├── fx.py
│   │   ├── gold_lease.py
│   │   ├── derivatives.py
│   │   ├── performance.py
│   │   └── cost.py
│   ├── models/          # Pydantic 模型
│   ├── services/        # 业务逻辑层
│   ├── repositories/    # 数据访问层
│   ├── tasks/           # Celery 异步任务
│   ├── data/            # 数据库文件
│   │   └── ficc_brain.db
│   ├── scripts/         # 数据生成脚本
│   │   ├── init_db.py
│   │   └── generate_data.py
│   ├── main.py          # FastAPI 入口
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/         # Next.js App Router 页面
│   │   │   ├── dashboard/
│   │   │   ├── bonds/
│   │   │   ├── fx/
│   │   │   ├── metals/
│   │   │   ├── derivatives/
│   │   │   └── performance/
│   │   ├── components/  # React 组件
│   │   │   ├── charts/  # 图表组件
│   │   │   ├── common/  # 通用组件
│   │   │   ├── filters/ # 筛选器组件
│   │   │   └── layout/  # 布局组件
│   │   ├── hooks/       # 自定义 Hooks
│   │   ├── providers/   # React Context Providers
│   │   ├── store/       # Zustand 状态管理
│   │   └── types/       # TypeScript 类型定义
│   ├── public/          # 静态资源
│   └── package.json
├── setup.bat / setup.sh # 安装脚本
└── start.bat / start.sh # 启动脚本
```

## 数据库表结构

### 基础维度表
- `business_lines` - 业务线维度
- `trading_books` - 交易簿维度
- `traders` - 交易员维度
- `products` - 产品维度
- `bond_dimensions` - 债券维度
- `fund_dimensions` - 基金维度

### 业务数据表
- `positions` - 持仓表
- `pnl_daily` - 日损益表
- `risk_capital` - 风险资本表
- `performance_monthly` - 月度绩效表
- `hedge_strategies` - 对冲策略表
- `market_data` - 市场数据快照表

### 扩展业务表
- `bond_lending_balance` - 债券借贷余额表
- `repo_balance` - 回购余额表
- `gold_lease_balance` - 黄金租借余额表
- `fund_positions` - 债券型基金余额表
- `bond_transactions` - 债券投资发生额表
- `derivatives_balance` - 衍生品业务余额表
- `fx_metals_transactions` - 外汇贵金属发生额表
- `collateral_details` - 押品明细表
- `cost_analysis` - 成本分析表
- `trader_assessment` - 交易员考核调整表

## API 端点

### 仪表盘
- `GET /api/v1/dashboard/overview` - FICC 整体概览
- `GET /api/v1/dashboard/trend` - 损益趋势

### 债券业务
- `GET /api/v1/bonds/pnl` - 债券损益
- `GET /api/v1/bonds/risk` - 债券风险
- `GET /api/v1/bonds/lending` - 债券借贷业务
- `GET /api/v1/bonds/transactions` - 债券投资发生额
- `GET /api/v1/bonds/collateral` - 债券借贷押品明细

### 基金业务
- `GET /api/v1/funds/pnl` - 基金损益
- `GET /api/v1/funds/positions` - 基金持仓
- `GET /api/v1/funds/transactions` - 基金发生额

### 回购业务
- `GET /api/v1/repo/balance` - 回购余额
- `GET /api/v1/repo/transactions` - 回购发生额
- `GET /api/v1/repo/collateral` - 回购押品

### 外汇业务
- `GET /api/v1/fx/pnl` - 外汇损益
- `GET /api/v1/fx/market-analysis` - 外汇市场分析
- `GET /api/v1/fx/transactions` - 外汇贵金属发生额

### 贵金属业务
- `GET /api/v1/precious-metals/pnl` - 贵金属损益

### 黄金租借业务
- `GET /api/v1/gold-lease/balance` - 黄金租借余额
- `GET /api/v1/gold-lease/transactions` - 黄金租借发生额

### 衍生品业务
- `GET /api/v1/derivatives/balance` - 衍生品业务余额
- `GET /api/v1/derivatives/transactions` - 衍生品业务发生额

### 利率衍生品
- `GET /api/v1/ir-derivatives/hedge` - 利率衍生品对冲

### 绩效分析
- `GET /api/v1/performance/raroc` - RAROC 分析
- `GET /api/v1/performance/eva` - EVA 贡献
- `GET /api/v1/performance/trader-assessment` - 交易员考核调整

### 资本与成本
- `GET /api/v1/capital/usage` - 资本占用
- `GET /api/v1/cost/analysis` - 成本分析

## 设计规范

- **品牌色**: #C7162E (招商银行红)
- **风格**: 浅色系专业金融界面
- **图表**: 使用 @ant-design/charts 或 AntV G2/G6 专业金融图表

## 数据规模

| 表名 | 记录数 | 说明 |
|------|-------|------|
| business_lines | 6 | 业务线维度 |
| traders | 50 | 交易员维度 |
| trading_books | 20 | 交易簿维度 |
| products | 500 | 产品维度 |
| pnl_daily | 3,600 | 20个交易簿 × 180天 |
| risk_capital | 520 | 20个交易簿 × 26周 |
| performance_monthly | 120 | 20个交易簿 × 6个月 |
| bond_transactions | 72,000 | 债券投资发生额数据 |
| bond_lending_balance | 36,000 | 债券借贷余额数据 |
| fund_positions | 36,000 | 基金持仓数据 |
| repo_balance | 18,000 | 回购余额数据 |
| gold_lease_balance | 9,000 | 黄金租借余额数据 |
| derivatives_balance | 12,000 | 衍生品业务余额数据 |
| fx_metals_transactions | 18,000 | 外汇贵金属发生额数据 |
| collateral_details | 24,000 | 押品明细数据 |
| cost_analysis | 360 | 成本分析数据 |
| trader_assessment | 18,000 | 交易员考核调整数据 |

**总记录数**：约 500,000 条
**数据库大小**：约 150-250 MB

## 注意事项

1. 后端 API 默认运行在 `http://localhost:8000`
2. 前端开发服务器默认运行在 `http://localhost:3000`
3. CORS 已配置允许前端访问后端 API
4. 数据库使用 SQLite，文件位于 `backend/data/ficc_brain.db`
5. 完成代码修改后，前端需运行 `npm run lint` 检查代码规范
6. 异步任务使用 Celery + Redis，需要启动 Redis 服务
7. 数据生成脚本位于 `backend/scripts/` 目录
8. 项目采用分层架构：API 层 → Service 层 → Repository 层 → 数据库层

## 性能要求

- 页面加载时间 < 3秒
- 数据查询响应 < 1秒
- 图表渲染时间 < 2秒
- 支持并发用户数：10人（MVP阶段）

## 浏览器支持

- Chrome 90+
- Firefox 88+
- Safari 14+
- 分辨率：1920x1080 及以上
