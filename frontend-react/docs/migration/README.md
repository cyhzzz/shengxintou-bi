# 前端迁移规范文档

## 概述

本文档定义了从原生 JavaScript 前端迁移到 React + TypeScript 前端的规范和最佳实践。

## 目录

1. [迁移原则](./01-migration-principles.md) - 核心迁移原则和目标
2. [API 类型自动生成](./02-api-type-generation.md) - 使用 orval 自动生成 TypeScript 类型
3. [组件迁移规范](./03-component-migration.md) - 组件迁移的具体步骤
4. [状态管理迁移](./04-state-management.md) - Zustand 状态管理最佳实践
5. [样式迁移规范](./05-styling-migration.md) - SCSS 模块化样式规范

## 快速开始

### 安装依赖

```bash
cd frontend-react
npm install
```

### 生成 API 类型

```bash
npm run generate:api
```

### 开发模式

```bash
npm run dev
```

### 构建生产版本

```bash
npm run build
```

## 技术栈

- **框架**: React 19 + TypeScript 5
- **构建工具**: Vite 7
- **UI 库**: Ant Design 6
- **状态管理**: Zustand 5
- **路由**: React Router 7
- **图表**: @ant-design/charts
- **HTTP 客户端**: 自定义 Fetch 封装
- **类型生成**: orval + openapi-typescript

## 项目结构

```
frontend-react/
├── src/
│   ├── components/       # 可复用组件
│   │   ├── Chart/       # 图表组件
│   │   ├── Filter/      # 筛选器组件
│   │   ├── HelpModal/   # 帮助模态框
│   │   └── Icon/        # 图标组件
│   ├── layouts/         # 布局组件
│   ├── pages/           # 页面组件
│   │   ├── Dashboard/           # 数据概览
│   │   ├── AgencyAnalysis/      # 厂商分析
│   │   ├── XhsNotes/            # 小红书报表
│   │   ├── LeadsDetail/         # 线索明细
│   │   ├── ConversionFunnel/    # 转化漏斗
│   │   ├── EmployeeConversion/  # 员工转化报表
│   │   └── System/              # 系统配置
│   ├── router/          # 路由配置
│   ├── services/        # API 服务
│   ├── stores/          # Zustand 状态
│   ├── styles/          # 全局样式
│   ├── types/           # TypeScript 类型定义
│   │   ├── api.ts       # API 响应类型（自动生成）
│   │   ├── models.ts    # 业务模型类型
│   │   └── charts.ts    # 图表数据类型
│   └── main.tsx         # 应用入口
├── docs/                # 文档
│   └── migration/       # 迁移规范文档
├── public/              # 静态资源
├── orval.config.ts      # orval 配置
├── vite.config.ts       # Vite 配置
└── tsconfig.json        # TypeScript 配置
```

## 迁移进度

| 模块 | 原生 JS 文件 | React 组件 | 状态 |
|------|-------------|-----------|------|
| 布局 | Sidebar.js, main.js | MainLayout.tsx | ✅ 完成 |
| 数据概览 | DashboardReport.js | Dashboard/index.tsx | ✅ 完成 |
| 厂商分析 | AgencyAnalysisReport.js | AgencyAnalysis/index.tsx | ✅ 完成 |
| 小红书笔记列表 | XhsNotesListReport.js | XhsNotes/List.tsx | ✅ 完成 |
| 小红书运营分析 | XhsNotesOperationReport.js | XhsNotes/Operation.tsx | ✅ 完成 |
| 线索明细 | LeadsDetailReport.js | LeadsDetail/index.tsx | ✅ 完成 |
| 转化漏斗 | ConversionFunnelReport.js | ConversionFunnel/index.tsx | ✅ 完成 |
| 员工转化分析 | EmployeeConversionAnalysis.js | EmployeeConversion/Analysis.tsx | ✅ 完成 |
| 员工转化周报 | EmployeeConversionWeekly.js | EmployeeConversion/Weekly.tsx | ✅ 完成 |
| 数据导入 | DataImport.js | System/DataImport.tsx | ✅ 完成 |
| 账号管理 | AccountManagementReport.js | System/AccountManagement.tsx | ✅ 完成 |
| 简称管理 | AbbreviationManagement.js | System/AbbreviationManagement.tsx | ✅ 完成 |
| 数据库备份 | DatabaseBackup.js | System/DatabaseBackup.tsx | ✅ 完成 |

## 相关文档

- [前端设计规范](../../../.claude/rules/frontend-design/)
- [API 接口规则](../../../.claude/rules/api-rules.md)
- [数据库架构](../../../.claude/rules/database-architecture.md)