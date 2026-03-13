# 省心投 BI - 前端页面迁移 PRD 文档

> **版本**: v1.0.0
> **更新时间**: 2026-03-13
> **适用范围**: 12个前端页面从旧版JS迁移至新版React前端

---

## 📋 概述

本文档详细描述了12个前端页面的迁移需求，包括功能规范、API接口、组件设计和验收标准。

**迁移页面列表**:

| 序号 | 页面名称 | 路由标识 | 优先级 | 复杂度 |
|------|---------|----------|--------|--------|
| 1 | 转化漏斗 | conversion-funnel | P0 | 高 |
| 2 | 线索明细 | leads-detail | P0 | 中 |
| 3 | 厂商分析 | agency-analysis | P0 | 高 |
| 4 | 小红书-笔记列表 | xhs-notes-list | P1 | 中 |
| 5 | 小红书-运营分析 | xhs-notes-operation | P1 | 中 |
| 6 | 员工转化-转化分析 | employee-conversion-analysis | P1 | 高 |
| 7 | 员工转化-转化周报 | employee-conversion-weekly | P2 | 中 |
| 8 | 系统配置-数据导入 | data-import | P0 | 低 |
| 9 | 账号管理 | account-management | P0 | 中 |
| 10 | 简称管理 | abbreviation-management | P2 | 低 |
| 11 | 数据同步 | database-backup | P2 | 低 |
| 12 | 报告生成 | report-generation | P2 | 中 |

---

## ⚠️ 迁移前必读：经验教训检查清单

> **来源**: Dashboard迁移中发现的问题，必须在所有页面迁移中避免。

### 1. API 参数完整性检查

- [ ] 对比旧版前端 API 调用参数与新版是否一致
- [ ] 检查可选参数是否都有对应的状态和回调
- [ ] 确认 TypeScript 类型定义是否包含所有 API 参数
- [ ] 测试所有交互功能是否正常触发 API 调用

### 2. 筛选器选项验证

- [ ] 筛选器选项来源：硬编码 vs API 元数据
- [ ] 对比旧版前端筛选器的完整选项列表
- [ ] 确认筛选器组件的 `options` prop 格式正确
- [ ] 测试筛选器的默认值和初始选中状态

### 3. 图表组件完整性验证

- [ ] 图表标题是否显示
- [ ] 图表工具栏（刷新、导出、切换）是否完整
- [ ] 图表切换按钮（指标切换、粒度切换）是否功能正常
- [ ] 图表 loading 状态和空状态是否处理

### 4. 布局一致性验证

- [ ] 对比旧版前端的布局（卡片数量、行列关系）
- [ ] 确认卡片使用统一的样式变体
- [ ] 验证响应式布局（不同屏幕宽度）
- [ ] 检查卡片高度是否一致

### 5. TypeScript 类型定义验证

- [ ] 对比后端 API 文档/代码与 TypeScript 类型定义
- [ ] 检查可选字段是否标记为可选（`?`）
- [ ] 确认枚举类型是否完整
- [ ] 验证类型扩展是否正确

---

# 页面迁移详细规范

---

## 1. 转化漏斗 (ConversionFunnel)

### 1.1 页面概述

**功能描述**: 从转化率角度展示广告投放各环节的数据转化情况，支持员工模式和广告模式切换。

**路由标识**: `conversion-funnel`

**旧版文件**: `开发代码/frontend/js/reports/ConversionFunnelReport.js`

**新版文件**: `开发代码/frontend-react/src/pages/ConversionFunnel/index.tsx`

### 1.2 核心功能

| 功能模块 | 说明 | 优先级 |
|---------|------|--------|
| 转化漏斗图 | 7层漏斗可视化展示 | P0 |
| 转化率列表 | 各环节转化率数据 | P0 |
| 核心指标卡片 | 总线索、总开户、转化率 | P0 |
| 筛选器 | 平台、业务模式、代理商、员工、日期 | P0 |
| 模式切换 | 员工模式(5层) / 广告模式(7层) | P1 |
| 数据导出 | 导出漏斗数据 | P2 |

### 1.3 漏斗层级设计

**广告模式 (7层)**:
```
曝光 → 点击人数 → 线索人数 → 开口人数 → 有效线索 → 开户人数 → 有效户人数
```

**员工模式 (5层)**:
```
线索人数 → 开口人数 → 有效线索 → 开户人数 → 有效户人数
```

**转化率计算**:
- 各环节转化率 = 下一层数量 / 当前层数量 × 100%
- 整体转化率 = 最终层数量 / 首层数量 × 100%

### 1.4 筛选器设计

```tsx
interface ConversionFunnelFilters {
  // 平台筛选（多选）
  platforms: string[];

  // 业务模式筛选（多选）
  business_models: string[];

  // 代理商筛选（多选）
  agencies: string[];

  // 员工筛选（多选）
  employees: string[];

  // 日期范围
  start_date: string;
  end_date: string;

  // 快捷日期按钮
  date_preset: 'all' | '7d' | '30d' | '90d' | 'custom';
}
```

**筛选器布局**:
```
[日期快捷按钮: 全选 | 近7天 | 近30天 | 近90天 | 自定义]
[平台多选] [业务模式多选] [代理商多选] [员工多选]
                                              [查询] [重置]
```

### 1.5 布局设计

**两栏布局**:

```
┌─────────────────────────────────────────────────────────────┐
│                        筛选器区域                            │
└─────────────────────────────────────────────────────────────┘
┌──────────────────┐  ┌────────────────────────────────────────┐
│                  │  │  核心指标卡片 (总线索/总开户/转化率)    │
│   转化率列表     │  └────────────────────────────────────────┘
│                  │  ┌────────────────────────────────────────┐
│   - 曝光→点击    │  │                                        │
│   - 点击→线索    │  │          转化漏斗图 (ECharts)          │
│   - 线索→开口    │  │                                        │
│   - 开口→有效    │  │                                        │
│   - 有效→开户    │  │                                        │
│   - 开户→有效户  │  │                                        │
│                  │  └────────────────────────────────────────┘
│                  │  ┌────────────────────────────────────────┐
│                  │  │  综合转化率 (线索→有效户)              │
│                  │  └────────────────────────────────────────┘
└──────────────────┘
```

### 1.6 API 接口

**获取漏斗数据**:
```
POST /api/v1/conversion-funnel
```

**请求参数**:
```typescript
interface ConversionFunnelRequest {
  start_date: string;
  end_date: string;
  platforms?: string[];
  business_models?: string[];
  agencies?: string[];
  employees?: string[];
  mode?: 'ad' | 'employee';  // 广告模式 / 员工模式
}
```

**响应数据**:
```typescript
interface ConversionFunnelResponse {
  success: boolean;
  data: {
    // 漏斗数据
    funnel: Array<{
      stage: string;        // 阶段名称
      count: number;        // 数量
      rate: number;         // 转化率
    }>;

    // 核心指标
    summary: {
      total_leads: number;
      total_opened: number;
      overall_rate: number;
    };

    // 各环节转化率
    conversion_rates: Array<{
      from_stage: string;
      to_stage: string;
      rate: number;
    }>;
  };
}
```

### 1.7 组件设计

```
src/pages/ConversionFunnel/
├── index.tsx                    # 页面主组件
├── components/
│   ├── FilterBar.tsx           # 筛选器组件
│   ├── FunnelChart.tsx         # 漏斗图组件
│   ├── ConversionRateList.tsx  # 转化率列表组件
│   ├── MetricCards.tsx         # 核心指标卡片
│   └── CombinedRate.tsx        # 综合转化率组件
├── hooks/
│   └── useFunnelData.ts        # 数据获取Hook
├── types.ts                     # 类型定义
└── index.module.scss           # 样式文件
```

### 1.8 验收标准

#### 功能验收

- [ ] 漏斗图正确显示7层/5层（根据模式）
- [ ] 转化率列表数据与漏斗图一致
- [ ] 核心指标卡片数据正确
- [ ] 筛选器所有选项功能正常
- [ ] 员工模式/广告模式切换正常
- [ ] 数据导出功能正常

#### API 参数验收

- [ ] 所有筛选参数正确传递
- [ ] mode 参数正确区分广告/员工模式
- [ ] 日期范围参数格式正确

#### 样式验收

- [ ] 两栏布局响应式正常
- [ ] 漏斗图颜色渐变正确（#00ABEB → #00479D）
- [ ] 转化率列表悬停效果正常

---

## 2. 线索明细 (LeadsDetail)

### 2.1 页面概述

**功能描述**: 展示所有客户线索到转化的数据明细，支持多维度筛选和分页。

**路由标识**: `leads-detail`

**旧版文件**: `开发代码/frontend/js/reports/LeadsDetailReport.js`

**新版文件**: `开发代码/frontend-react/src/pages/LeadsDetail/index.tsx`

### 2.2 核心功能

| 功能模块 | 说明 | 优先级 |
|---------|------|--------|
| 数据表格 | 40字段明细数据展示 | P0 |
| 分页功能 | 50条/页，支持跳页 | P0 |
| 筛选器 | 日期、平台、代理商 | P0 |
| 数据导出 | 导出CSV | P1 |
| 字段格式化 | 布尔、日期、货币、数值 | P0 |

### 2.3 数据表格字段 (40个)

**基本信息 (4个)**:
- wechat_nickname - 微信昵称
- capital_account - 资金账号
- opening_branch - 开户营业部
- customer_gender - 客户性别

**平台和流量信息 (3个)**:
- platform_source - 平台来源
- traffic_type - 流量类型
- customer_source - 客户来源

**布尔字段 (8个)**:
- is_customer_mouth - 是否客户开口
- is_valid_lead - 是否有效线索
- is_open_account_interrupted - 是否开户中断
- is_opened_account - 是否开户
- is_valid_customer - 是否为有效户
- is_existing_customer - 是否为存量客户
- is_existing_valid_customer - 是否为存量有效户
- is_delete_enterprise_wechat - 是否删除企微

**时间字段 (7个)**:
- lead_date - 线索日期
- open_account_interrupted_date - 开户中断日期
- first_contact_time - 首次触达时间
- last_contact_time - 最近互动时间
- account_opening_time - 开户时间
- wechat_verify_time - 微信认证时间
- valid_customer_time - 有效户时间

**数值字段 (4个)**:
- interaction_count - 互动次数
- sales_interaction_count - 营销人员互动次数
- assets - 资产
- customer_contribution - 客户贡献

**人员信息 (3个)**:
- add_employee_no - 添加员工号
- add_employee_name - 添加员工姓名
- wechat_verify_status - 微信认证状态

**广告投放信息 (4个)**:
- ad_account - 广告账号
- agency - 广告代理商
- ad_id - 广告ID
- creative_id - 创意ID

**小红书笔记信息 (2个)**:
- note_id - 笔记ID
- note_title - 笔记名称

**平台用户信息 (2个)**:
- platform_user_id - 平台用户ID
- platform_user_nickname - 平台用户昵称

**其他信息 (2个)**:
- producer - 生产者
- enterprise_wechat_tags - 企微标签

### 2.4 筛选器设计

```tsx
interface LeadsDetailFilters {
  // 日期范围
  start_date: string;
  end_date: string;

  // 平台筛选（多选）
  platforms: string[];

  // 代理商筛选（多选）
  agencies: string[];
}
```

### 2.5 布局设计

```
┌─────────────────────────────────────────────────────────────┐
│                        筛选器区域                            │
│  [日期范围] [平台多选] [代理商多选]  [查询] [重置] [导出]   │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                        数据统计                              │
│  共 XXXX 条记录                                              │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                        数据表格                              │
│  ┌────┬────────┬────────┬────────┬────────┬────────┐       │
│  │ 序号│ 微信昵称│ 平台来源│ 线索日期│ 是否开户│ ...    │       │
│  ├────┼────────┼────────┼────────┼────────┼────────┤       │
│  │ 1  │ 张三   │ 腾讯   │2025-01-│   是   │ ...    │       │
│  │ 2  │ 李四   │ 抖音   │2025-01-│   否   │ ...    │       │
│  └────┴────────┴────────┴────────┴────────┴────────┘       │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                        分页控件                              │
│  [<] [1] [2] [3] ... [10] [>]  跳转 [__] 页                 │
└─────────────────────────────────────────────────────────────┘
```

### 2.6 API 接口

**获取线索明细**:
```
GET /api/v1/leads-detail
```

**请求参数**:
```typescript
interface LeadsDetailRequest {
  page: number;
  page_size: number;
  start_date?: string;
  end_date?: string;
  platforms?: string[];
  agencies?: string[];
}
```

**响应数据**:
```typescript
interface LeadsDetailResponse {
  success: boolean;
  data: {
    total: number;
    page: number;
    page_size: number;
    items: LeadsDetailItem[];
  };
}
```

### 2.7 字段格式化规则

| 字段类型 | 格式化规则 | 示例 |
|---------|-----------|------|
| 布尔值 | 是/否 | `是` / `否` |
| 日期 | YYYY-MM-DD | `2025-01-15` |
| 日期时间 | YYYY-MM-DD HH:mm | `2025-01-15 14:30` |
| 货币 | ¥X,XXX.XX | `¥1,234.56` |
| 数值 | X,XXX | `1,234` |

### 2.8 组件设计

```
src/pages/LeadsDetail/
├── index.tsx                    # 页面主组件
├── components/
│   ├── FilterBar.tsx           # 筛选器组件
│   ├── DataTable.tsx           # 数据表格组件
│   └── Pagination.tsx          # 分页组件
├── hooks/
│   └── useLeadsData.ts         # 数据获取Hook
├── types.ts                     # 类型定义
├── columns.tsx                  # 表格列配置
└── index.module.scss           # 样式文件
```

### 2.9 验收标准

#### 功能验收

- [ ] 表格正确显示所有40个字段
- [ ] 分页功能正常，50条/页
- [ ] 筛选器所有选项功能正常
- [ ] 导出CSV功能正常
- [ ] 字段格式化正确

#### API 参数验收

- [ ] 分页参数正确传递
- [ ] 筛选参数正确传递
- [ ] 总记录数显示正确

#### 性能验收

- [ ] 表格渲染时间 < 1s
- [ ] 分页切换响应 < 500ms

---

## 3. 厂商分析 (AgencyAnalysis)

### 3.1 页面概述

**功能描述**: 按代理商维度分析投放和转化数据，支持趋势图和对比分析。

**路由标识**: `agency-analysis`

**旧版文件**: `开发代码/frontend/js/reports/AgencyAnalysisReport.js`

**新版文件**: `开发代码/frontend-react/src/pages/AgencyAnalysis/index.tsx`

### 3.2 核心功能

| 功能模块 | 说明 | 优先级 |
|---------|------|--------|
| 指标卡片 | 花费、曝光、点击、线索、开户 | P0 |
| 趋势图 | 日级数据趋势，支持指标切换 | P0 |
| 数据表格 | 代理商维度聚合数据 | P0 |
| 筛选器 | 平台、业务模式、代理商、日期 | P0 |
| 数据导出 | 导出Excel | P1 |

### 3.3 筛选器设计

```tsx
interface AgencyAnalysisFilters {
  // 平台筛选（多选）
  platforms: string[];

  // 业务模式筛选（多选）
  business_models: string[];

  // 代理商筛选（多选）
  agencies: string[];

  // 日期范围
  start_date: string;
  end_date: string;
}
```

### 3.4 布局设计

```
┌─────────────────────────────────────────────────────────────┐
│                        筛选器区域                            │
│  [平台多选] [业务模式多选] [代理商多选] [日期范围]           │
│                                              [查询] [重置]   │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                     核心指标卡片 (5个)                       │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐│
│  │ 总花费  │ │ 总曝光  │ │ 总点击  │ │ 总线索  │ │ 总开户  ││
│  │ ¥XXX万 │ │ XXX万  │ │ XXX万  │ │ XXXX   │ │ XXX    ││
│  │ ↑12%   │ │ ↑8%    │ │ ↑15%   │ │ ↑10%   │ │ ↑5%    ││
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘│
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                     趋势图 (ECharts)                         │
│  [指标切换: 花费 | 曝光 | 点击 | 线索 | 开户]               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                                                         ││
│  │                    折线图/柱状图                        ││
│  │                                                         ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                     数据表格                                 │
│  ┌────────┬────────┬────────┬────────┬────────┬────────┐   │
│  │ 代理商 │ 平台   │ 业务模式│ 花费   │ 曝光   │ ...    │   │
│  ├────────┼────────┼────────┼────────┼────────┼────────┤   │
│  │ 量子   │ 腾讯   │ 直播   │ ¥10万  │ 100万  │ ...    │   │
│  │ 众联   │ 抖音   │ 信息流 │ ¥15万  │ 150万  │ ...    │   │
│  └────────┴────────┴────────┴────────┴────────┴────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 3.5 API 接口

**获取厂商分析数据**:
```
POST /api/v1/agency-analysis
```

**请求参数**:
```typescript
interface AgencyAnalysisRequest {
  start_date: string;
  end_date: string;
  platforms?: string[];
  business_models?: string[];
  agencies?: string[];
}
```

**响应数据**:
```typescript
interface AgencyAnalysisResponse {
  success: boolean;
  data: {
    // 汇总指标
    summary: {
      cost: number;
      impressions: number;
      clicks: number;
      lead_users: number;
      opened_account_users: number;
    };

    // 趋势数据
    trend: Array<{
      date: string;
      cost: number;
      impressions: number;
      clicks: number;
      lead_users: number;
      opened_account_users: number;
    }>;

    // 代理商明细
    details: Array<{
      agency: string;
      platform: string;
      business_model: string;
      cost: number;
      impressions: number;
      clicks: number;
      lead_users: number;
      opened_account_users: number;
    }>;
  };
}
```

### 3.6 组件设计

```
src/pages/AgencyAnalysis/
├── index.tsx                    # 页面主组件
├── components/
│   ├── FilterBar.tsx           # 筛选器组件
│   ├── MetricCards.tsx         # 指标卡片组件
│   ├── TrendChart.tsx          # 趋势图组件
│   └── DataTable.tsx           # 数据表格组件
├── hooks/
│   └── useAgencyData.ts        # 数据获取Hook
├── types.ts                     # 类型定义
└── index.module.scss           # 样式文件
```

### 3.7 验收标准

#### 功能验收

- [ ] 指标卡片数据正确，支持环比显示
- [ ] 趋势图正确渲染，指标切换正常
- [ ] 数据表格排序功能正常
- [ ] 筛选器所有选项功能正常
- [ ] 数据导出功能正常

#### API 参数验收

- [ ] 所有筛选参数正确传递
- [ ] 趋势数据日期范围正确

---

## 4. 小红书-笔记列表 (XhsNotesList)

### 4.1 页面概述

**功能描述**: 小红书笔记数据管理与查看，展示笔记日级投放和运营数据。

**路由标识**: `xhs-notes-list`

**旧版文件**: `开发代码/frontend/js/reports/XhsNotesListReport.js`

**新版文件**: `开发代码/frontend-react/src/pages/XhsNotes/List.tsx`

### 4.2 核心功能

| 功能模块 | 说明 | 优先级 |
|---------|------|--------|
| 数据表格 | 笔记日级数据展示 | P0 |
| 分页功能 | 50条/页 | P0 |
| 筛选器 | 日期、笔记标题搜索 | P0 |
| 数据导出 | 导出CSV | P1 |
| 字段格式化 | 数值、货币 | P0 |

### 4.3 数据表格字段

| 字段 | 类型 | 说明 |
|-----|------|------|
| date | 日期 | 数据日期 |
| note_id | 字符串 | 笔记ID |
| note_title | 字符串 | 笔记标题 |
| creator_name | 字符串 | 创作者名称 |
| producer | 字符串 | 生产者 |
| ad_strategy | 字符串 | 投放策略 |
| cost | 货币 | 消耗金额 |
| impressions | 数值 | 展现量 |
| clicks | 数值 | 点击量 |
| total_interactions | 数值 | 互动量 |
| lead_users | 数值 | 线索人数 |
| opened_account_users | 数值 | 开户人数 |

### 4.4 筛选器设计

```tsx
interface XhsNotesListFilters {
  // 日期范围
  start_date: string;
  end_date: string;

  // 笔记标题搜索
  note_title?: string;

  // 创作者筛选（可选）
  creator_name?: string;
}
```

### 4.5 API 接口

```
GET /api/v1/xhs-notes/list
```

### 4.6 验收标准

- [ ] 表格正确显示所有字段
- [ ] 分页功能正常
- [ ] 日期筛选功能正常
- [ ] 笔记标题搜索功能正常
- [ ] 导出功能正常

---

## 5. 小红书-运营分析 (XhsNotesOperation)

### 5.1 页面概述

**功能描述**: 笔记运营效果分析，展示互动指标和转化数据趋势。

**路由标识**: `xhs-notes-operation`

**旧版文件**: `开发代码/frontend/js/reports/XhsNotesOperationReport.js`

**新版文件**: `开发代码/frontend-react/src/pages/XhsNotes/Operation.tsx`

### 5.2 核心功能

| 功能模块 | 说明 | 优先级 |
|---------|------|--------|
| 指标卡片 | 总笔记、总曝光、总互动 | P0 |
| 趋势图 | 日级数据趋势 | P0 |
| 互动分析 | 点赞、收藏、评论、分享 | P0 |
| 筛选器 | 日期、创作者 | P0 |

### 5.3 验收标准

- [ ] 指标卡片数据正确
- [ ] 趋势图正确渲染
- [ ] 互动分析数据正确
- [ ] 筛选器功能正常

---

## 6. 员工转化-转化分析 (EmployeeConversionAnalysis)

### 6.1 页面概述

**功能描述**: 员工转化数据分析和排名，展示各员工的开户转化情况。

**路由标识**: `employee-conversion-analysis`

**旧版文件**: `开发代码/frontend/js/reports/EmployeeConversionAnalysis.js`

**新版文件**: `开发代码/frontend-react/src/pages/EmployeeConversion/Analysis.tsx`

### 6.2 核心功能

| 功能模块 | 说明 | 优先级 |
|---------|------|--------|
| 指标卡片 | 总线索、总开户、平均开户率、总资产 | P0 |
| 趋势图 | 整体转化走势、员工开户转化率走势 | P0 |
| 排名表格 | 员工转化数据排名 | P0 |
| 筛选器 | 平台、日期、员工、线索类型 | P0 |
| 数据导出 | 导出排名CSV | P1 |

### 6.3 排名表格字段 (10个)

| 字段 | 说明 |
|-----|------|
| 排名 | 排名序号 |
| 服务人员 | 员工姓名 |
| 线索量 | 分配的线索总数 |
| 开口量 | 客户开口数量 |
| 有效线索 | 有效线索数量 |
| 开户量 | 开户数量 |
| 开户率 | 开户量 / 线索量 × 100% |
| 有效户 | 有效户数量 |
| 有效户率 | 有效户 / 开户量 × 100% |
| 总资产 | 客户总资产 |

### 6.4 筛选器设计

```tsx
interface EmployeeConversionFilters {
  // 平台筛选（多选）
  platforms: string[];

  // 日期范围
  start_date: string;
  end_date: string;

  // 员工筛选（多选）
  employees: string[];

  // 线索类型（单选）
  lead_type: 'all' | 'new' | 'existing';
}
```

### 6.5 布局设计

```
┌─────────────────────────────────────────────────────────────┐
│                        筛选器区域                            │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                     核心指标卡片 (4个)                       │
│  [总线索量] [总开户量] [平均开户率] [总资产]                │
└─────────────────────────────────────────────────────────────┘
┌──────────────────────────┐  ┌───────────────────────────────┐
│   整体转化走势(周度)     │  │  员工开户转化率走势           │
│   (折线图)              │  │  (折线图)                     │
└──────────────────────────┘  └───────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                     排名表格                                 │
│  [排名] [服务人员] [线索量] [开口量] ... [导出]            │
│  ┌────┬────────┬────────┬────────┬────────┐                │
│  │ 1  │ 张三   │ 100   │ 50    │ ...    │                │
│  │ 2  │ 李四   │ 90    │ 45    │ ...    │                │
│  └────┴────────┴────────┴────────┴────────┘                │
└─────────────────────────────────────────────────────────────┘
```

### 6.6 API 接口

```
POST /api/v1/employee-conversion/analysis
```

### 6.7 验收标准

- [ ] 指标卡片数据正确
- [ ] 两个趋势图正确渲染
- [ ] 排名表格数据正确
- [ ] 排名计算逻辑正确
- [ ] 导出功能正常

---

## 7. 员工转化-转化周报 (EmployeeConversionWeekly)

### 7.1 页面概述

**功能描述**: 员工转化周报数据汇总，支持按周查看转化情况。

**路由标识**: `employee-conversion-weekly`

**新版文件**: `开发代码/frontend-react/src/pages/EmployeeConversion/Weekly.tsx`

### 7.2 核心功能

| 功能模块 | 说明 | 优先级 |
|---------|------|--------|
| 周报表格 | 按周汇总的转化数据 | P0 |
| 周筛选 | 选择周次 | P0 |
| 数据对比 | 环比/同比对比 | P1 |

### 7.3 验收标准

- [ ] 周报数据正确
- [ ] 周筛选功能正常
- [ ] 数据对比显示正确

---

## 8. 系统配置-数据导入 (DataImport)

### 8.1 页面概述

**功能描述**: 数据导入管理，支持多种数据类型的Excel/CSV文件上传。

**路由标识**: `data-import`

**新版文件**: `开发代码/frontend-react/src/pages/System/DataImport.tsx`

### 8.2 核心功能

| 功能模块 | 说明 | 优先级 |
|---------|------|--------|
| 数据类型选择 | 选择导入数据类型 | P0 |
| 文件上传 | 拖拽/点击上传 | P0 |
| 导入进度 | 显示导入进度 | P0 |
| 导入结果 | 显示成功/失败条数 | P0 |
| 错误提示 | 显示错误详情 | P0 |

### 8.3 支持的数据类型

| 数据类型 | 说明 | 目标表 |
|---------|------|--------|
| tencent_ads | 腾讯广告数据 | raw_ad_data_tencent |
| douyin_ads | 抖音广告数据 | raw_ad_data_douyin |
| xiaohongshu_ads | 小红书广告数据 | raw_ad_data_xiaohongshu |
| xhs_notes_content_daily | 笔记运营数据 | xhs_notes_content_daily |
| xhs_notes_daily | 笔记投放数据 | xhs_notes_daily |
| xhs_notes_list | 笔记列表数据 | xhs_note_info |
| backend_conversion | 后端转化数据 | backend_conversions |

### 8.4 验收标准

- [ ] 所有数据类型可选择
- [ ] 文件上传功能正常
- [ ] 导入进度显示正确
- [ ] 导入结果显示正确
- [ ] 错误提示清晰

---

## 9. 账号管理 (AccountManagement)

### 9.1 页面概述

**功能描述**: 管理各平台广告账号与代理商、业务模式的映射关系。

**路由标识**: `account-management`

**新版文件**: `开发代码/frontend-react/src/pages/System/AccountManagement.tsx`

### 9.2 核心功能

| 功能模块 | 说明 | 优先级 |
|---------|------|--------|
| 账号列表 | 按平台分组显示 | P0 |
| 添加账号 | 新增映射关系 | P0 |
| 编辑账号 | 修改映射关系 | P0 |
| 删除账号 | 删除映射关系 | P0 |
| 搜索功能 | 按账号/代理商搜索 | P1 |

### 9.3 数据字段

| 字段 | 说明 |
|-----|------|
| platform | 平台（腾讯/抖音/小红书） |
| account_id | 投放账号ID |
| account_name | 账号名称 |
| main_account_id | 主账号ID（小红书） |
| agency | 代理商名称 |
| business_model | 业务模式 |

### 9.4 API 接口

```
GET /api/v1/account-agency-mapping
POST /api/v1/account-mapping
PUT /api/v1/account-mapping/{platform}/{account_id}
DELETE /api/v1/account-mapping/{platform}/{account_id}
```

### 9.5 验收标准

- [ ] 账号列表正确显示
- [ ] 添加功能正常
- [ ] 编辑功能正常
- [ ] 删除功能正常（需确认）
- [ ] 搜索功能正常

---

## 10. 简称管理 (AbbreviationManagement)

### 10.1 页面概述

**功能描述**: 管理代理商和平台的简称映射关系。

**路由标识**: `abbreviation-management`

**新版文件**: `开发代码/frontend-react/src/pages/System/AbbreviationManagement.tsx`

### 10.2 核心功能

| 功能模块 | 说明 | 优先级 |
|---------|------|--------|
| 映射列表 | 简称-全称映射列表 | P0 |
| 添加映射 | 新增映射关系 | P0 |
| 编辑映射 | 修改映射关系 | P0 |
| 删除映射 | 删除映射关系 | P0 |
| 启用/禁用 | 控制映射是否生效 | P1 |

### 10.3 验收标准

- [ ] 映射列表正确显示
- [ ] CRUD功能正常
- [ ] 启用/禁用功能正常

---

## 11. 数据同步 (DatabaseBackup)

### 11.1 页面概述

**功能描述**: 数据库备份和同步管理。

**路由标识**: `database-backup`

**新版文件**: `开发代码/frontend-react/src/pages/System/DatabaseBackup.tsx`

### 11.2 核心功能

| 功能模块 | 说明 | 优先级 |
|---------|------|--------|
| 备份列表 | 显示备份文件列表 | P0 |
| 创建备份 | 手动创建备份 | P0 |
| 恢复备份 | 从备份恢复 | P0 |
| 下载备份 | 下载备份文件 | P1 |

### 11.3 验收标准

- [ ] 备份列表正确显示
- [ ] 创建备份功能正常
- [ ] 恢复备份功能正常
- [ ] 下载功能正常

---

## 12. 报告生成 (ReportGeneration)

### 12.1 页面概述

**功能描述**: 生成符合格式的可视化周报、月报。

**路由标识**: `report-generation`

**新版文件**: `开发代码/frontend-react/src/pages/ReportGeneration/index.tsx`

### 12.2 核心功能

| 功能模块 | 说明 | 优先级 |
|---------|------|--------|
| 模板选择 | 选择报告模板 | P0 |
| 日期选择 | 选择报告日期范围 | P0 |
| 预览报告 | 预览生成的报告 | P0 |
| 导出报告 | 导出PDF/Excel/PPT | P1 |

### 12.3 验收标准

- [ ] 模板列表正确显示
- [ ] 日期选择功能正常
- [ ] 预览功能正常
- [ ] 导出功能正常

---

## 附录A: 通用组件规范

### FilterBar 组件

```tsx
interface FilterBarProps {
  // 显示的筛选器
  showPlatform?: boolean;
  showBusinessModel?: boolean;
  showAgency?: boolean;
  showEmployee?: boolean;
  showDateRange?: boolean;
  showQuickDate?: boolean;

  // 回调函数
  onSearch: (filters: FilterValues) => void;
  onReset: () => void;
}
```

### MultiSelectDropdown 组件

```tsx
interface MultiSelectDropdownProps {
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}
```

### DataTable 组件

```tsx
interface DataTableProps {
  columns: ColumnType[];
  dataSource: any[];
  loading?: boolean;
  pagination?: {
    current: number;
    pageSize: number;
    total: number;
  };
  onChange?: (pagination: any) => void;
}
```

---

## 附录B: API 响应格式规范

### 成功响应

```json
{
  "success": true,
  "data": { /* 响应数据 */ },
  "message": "操作成功"
}
```

### 错误响应

```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "错误描述"
}
```

---

## 附录C: 样式规范

### 卡片间距

```scss
.card + .card {
  margin-top: var(--spacing-lg);  /* 20px */
}
```

### 响应式断点

```scss
/* 平板 */
@media (max-width: 768px) { }

/* 手机 */
@media (max-width: 576px) { }
```

---

**文档维护者**: Claude AI
**最后更新**: 2026-03-13
**状态**: ✅ 完成