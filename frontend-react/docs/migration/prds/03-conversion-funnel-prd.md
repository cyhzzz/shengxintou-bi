# 转化漏斗页面迁移 PRD

> **版本**: v1.0.0
> **更新时间**: 2026-03-13
> **负责人**: Claude AI

---

## 1. 需求概述

### 1.1 项目背景

将旧版 JavaScript 前端的转化漏斗报表迁移至新版 React + TypeScript 前端，保持功能完全对等，同时提升代码质量和类型安全。

### 1.2 目标用户

- 广告投放运营人员
- 数据分析师
- 管理层

### 1.3 核心目标

1. **功能对等**: 迁移后的功能必须与原有功能完全一致
2. **类型安全**: 充分利用 TypeScript 的类型系统
3. **组件复用**: 提取可复用组件，减少代码重复
4. **性能优化**: 提升渲染性能和用户体验

---

## 2. 功能需求

### 2.1 功能清单

| 功能ID | 功能名称 | 说明 | 优先级 |
|--------|---------|------|--------|
| F001 | 转化漏斗图 | 7层/5层漏斗可视化 | P0 |
| F002 | 转化率列表 | 各环节转化率数据展示 | P0 |
| F003 | 核心指标卡片 | 总线索、总开户、转化率 | P0 |
| F004 | 筛选器 | 平台、业务模式、代理商、员工、日期 | P0 |
| F005 | 模式切换 | 员工模式/广告模式 | P1 |
| F006 | 数据导出 | 导出漏斗数据 | P2 |

### 2.2 功能详细说明

#### F001: 转化漏斗图

**广告模式 (7层)**:
```
曝光 → 点击人数 → 线索人数 → 开口人数 → 有效线索 → 开户人数 → 有效户人数
```

**员工模式 (5层)**:
```
线索人数 → 开口人数 → 有效线索 → 开户人数 → 有效户人数
```

**设计要求**:
- 使用 ECharts 自定义渲染
- 品牌色渐变: `#00ABEB` → `#00479D`
- 每层显示: 名称、数量、转化率
- 悬停显示详细数据

#### F002: 转化率列表

**数据项**:
| 环节 | 计算方式 |
|-----|---------|
| 曝光→点击 | 点击人数 / 曝光 × 100% |
| 点击→线索 | 线索人数 / 点击人数 × 100% |
| 线索→开口 | 开口人数 / 线索人数 × 100% |
| 开口→有效 | 有效线索 / 开口人数 × 100% |
| 有效→开户 | 开户人数 / 有效线索 × 100% |
| 开户→有效户 | 有效户人数 / 开户人数 × 100% |

**显示格式**:
- 列表形式展示
- 显示转化率百分比
- 颜色标识：正增长绿色，负增长红色

#### F003: 核心指标卡片

| 指标 | 说明 | 格式 |
|-----|------|------|
| 总线索量 | 线索人数总和 | 数字，千分位 |
| 总开户量 | 开户人数总和 | 数字，千分位 |
| 整体转化率 | 有效户/线索×100% | 百分比，保留1位小数 |

#### F004: 筛选器

**筛选维度**:

| 筛选项 | 类型 | 数据来源 | 默认值 |
|--------|------|---------|--------|
| 平台 | 多选 | API元数据 | 全选 |
| 业务模式 | 多选 | API元数据 | 全选 |
| 代理商 | 多选 | API元数据 | 全选 |
| 员工 | 多选 | API元数据 | 全选 |
| 日期 | 快捷+自定义 | - | 近30天 |

**快捷日期按钮**:
- 全选
- 近7天
- 近30天
- 近90天
- 自定义

#### F005: 模式切换

**切换方式**: Radio.Group 按钮

| 模式 | 层级 | 说明 |
|------|------|------|
| 广告模式 | 7层 | 包含曝光、点击等广告数据 |
| 员工模式 | 5层 | 仅包含线索到转化的数据 |

---

## 3. 数据需求

### 3.1 数据源

**API端点**: `POST /api/v1/conversion-funnel`

### 3.2 请求参数

```typescript
interface ConversionFunnelRequest {
  // 日期范围
  start_date: string;  // YYYY-MM-DD
  end_date: string;    // YYYY-MM-DD

  // 筛选条件（可选）
  platforms?: string[];
  business_models?: string[];
  agencies?: string[];
  employees?: string[];

  // 显示模式
  mode?: 'ad' | 'employee';
}
```

### 3.3 响应数据

```typescript
interface ConversionFunnelResponse {
  success: boolean;
  data: {
    // 漏斗数据
    funnel: FunnelStage[];

    // 核心指标
    summary: {
      total_leads: number;
      total_opened: number;
      overall_rate: number;
    };

    // 转化率列表
    conversion_rates: ConversionRate[];
  };
}

interface FunnelStage {
  stage: string;      // 阶段名称
  stage_key: string;  // 阶段键名
  count: number;      // 数量
  rate: number;       // 到下一阶段的转化率
  color: string;      // 颜色值
}

interface ConversionRate {
  from_stage: string;   // 起始阶段
  to_stage: string;     // 目标阶段
  rate: number;         // 转化率
  trend: 'up' | 'down' | 'flat';  // 趋势
}
```

### 3.4 数据字典

| 字段名 | 类型 | 说明 | 示例 |
|--------|------|------|------|
| stage | string | 阶段名称 | "曝光" |
| count | number | 数量 | 100000 |
| rate | number | 转化率(0-100) | 12.5 |

---

## 4. 前端需求

### 4.1 页面结构

```
src/pages/ConversionFunnel/
├── index.tsx                    # 页面主组件
├── components/
│   ├── FilterBar.tsx           # 筛选器组件
│   ├── FunnelChart.tsx         # 漏斗图组件
│   ├── ConversionRateList.tsx  # 转化率列表
│   ├── MetricCards.tsx         # 核心指标卡片
│   └── CombinedRate.tsx        # 综合转化率
├── hooks/
│   ├── useFunnelData.ts        # 数据获取Hook
│   └── useFilters.ts           # 筛选器状态Hook
├── types.ts                     # 类型定义
├── constants.ts                 # 常量定义
└── index.module.scss           # 样式文件
```

### 4.2 组件设计

#### FilterBar 组件

```tsx
interface FilterBarProps {
  filters: FilterState;
  onFilterChange: (filters: Partial<FilterState>) => void;
  onSearch: () => void;
  onReset: () => void;
  showEmployeeFilter?: boolean;
}

interface FilterState {
  platforms: string[];
  business_models: string[];
  agencies: string[];
  employees: string[];
  start_date: string;
  end_date: string;
  date_preset: DatePreset;
}
```

#### FunnelChart 组件

```tsx
interface FunnelChartProps {
  data: FunnelStage[];
  mode: 'ad' | 'employee';
  loading?: boolean;
  height?: number;
}
```

#### ConversionRateList 组件

```tsx
interface ConversionRateListProps {
  data: ConversionRate[];
  loading?: boolean;
}
```

#### MetricCards 组件

```tsx
interface MetricCardsProps {
  summary: {
    total_leads: number;
    total_opened: number;
    overall_rate: number;
  };
  loading?: boolean;
}
```

### 4.3 布局设计

**两栏布局**:
- 左栏: 转化率列表 (宽度: 240px)
- 右栏: 核心指标卡片 + 漏斗图 + 综合转化率

**响应式**:
- 大屏(>1200px): 两栏布局
- 中屏(768-1200px): 转化率列表折叠为顶部
- 小屏(<768px): 单栏布局

### 4.4 样式规范

```scss
// 主容器
.conversionFunnelPage {
  padding: 20px;
}

// 两栏布局
.layoutContainer {
  display: flex;
  gap: 20px;

  @media (max-width: 768px) {
    flex-direction: column;
  }
}

// 左侧栏
.leftColumn {
  width: 240px;
  flex-shrink: 0;

  @media (max-width: 768px) {
    width: 100%;
  }
}

// 右侧栏
.rightColumn {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

// 转化率列表
.rateList {
  background: #fff;
  border-radius: 8px;
  padding: 16px;
}

// 漏斗图容器
.funnelChart {
  height: 400px;
  background: #fff;
  border-radius: 8px;
}
```

---

## 5. API 接口需求

### 5.1 获取漏斗数据

**请求**:
```http
POST /api/v1/conversion-funnel
Content-Type: application/json

{
  "start_date": "2025-01-01",
  "end_date": "2025-01-31",
  "platforms": ["腾讯", "抖音"],
  "business_models": ["直播"],
  "agencies": ["量子"],
  "employees": ["张三"],
  "mode": "ad"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "funnel": [
      {
        "stage": "曝光",
        "stage_key": "impressions",
        "count": 100000,
        "rate": 10.5,
        "color": "#00ABEB"
      },
      {
        "stage": "点击人数",
        "stage_key": "click_users",
        "count": 10500,
        "rate": 20.0,
        "color": "#009FD5"
      }
    ],
    "summary": {
      "total_leads": 2100,
      "total_opened": 105,
      "overall_rate": 5.0
    },
    "conversion_rates": [
      {
        "from_stage": "曝光",
        "to_stage": "点击人数",
        "rate": 10.5,
        "trend": "up"
      }
    ]
  }
}
```

### 5.2 获取筛选器选项

**请求**:
```http
GET /api/v1/metadata
```

**响应**:
```json
{
  "success": true,
  "data": {
    "platforms": ["腾讯", "抖音", "小红书"],
    "business_models": ["直播", "信息流", "搜索"],
    "agencies": ["量子", "众联", "风声"],
    "employees": ["张三", "李四", "王五"]
  }
}
```

---

## 6. 验收标准

### 6.1 功能验收

| 验收项 | 验收标准 | 通过条件 |
|--------|---------|---------|
| 漏斗图显示 | 7层/5层正确显示 | 各层数据正确 |
| 转化率计算 | 各环节转化率正确 | 与后端数据一致 |
| 筛选器功能 | 所有筛选条件生效 | API参数正确传递 |
| 模式切换 | 广告/员工模式切换正常 | 层级数量正确 |
| 数据导出 | 导出CSV正常 | 文件可正常打开 |

### 6.2 性能验收

| 指标 | 标准 |
|-----|------|
| 首屏加载时间 | < 2s |
| 筛选响应时间 | < 1s |
| 图表渲染时间 | < 500ms |

### 6.3 兼容性验收

| 浏览器 | 版本要求 |
|--------|---------|
| Chrome | 最新版 |
| Firefox | 最新版 |
| Edge | 最新版 |
| Safari | 最新版 |

### 6.4 检查清单

#### API 参数检查

- [ ] start_date 参数正确传递
- [ ] end_date 参数正确传递
- [ ] platforms 参数正确传递（数组）
- [ ] business_models 参数正确传递（数组）
- [ ] agencies 参数正确传递（数组）
- [ ] employees 参数正确传递（数组）
- [ ] mode 参数正确传递（ad/employee）

#### 筛选器检查

- [ ] 平台选项从API获取
- [ ] 业务模式选项从API获取
- [ ] 代理商选项从API获取
- [ ] 员工选项从API获取
- [ ] 快捷日期按钮功能正常
- [ ] 自定义日期选择功能正常

#### 图表检查

- [ ] 图表标题显示正确
- [ ] 图表工具栏完整
- [ ] 图表颜色渐变正确
- [ ] 图表悬停提示正常

#### 布局检查

- [ ] 两栏布局正确
- [ ] 响应式布局正常
- [ ] 卡片间距一致

---

## 7. 风险与依赖

### 7.1 技术风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| ECharts版本兼容 | 图表渲染异常 | 使用与旧版相同的配置 |
| 大数据量渲染 | 性能下降 | 实现数据分页/聚合 |

### 7.2 依赖项

| 依赖 | 版本 | 用途 |
|------|------|------|
| React | 19.x | UI框架 |
| TypeScript | 5.x | 类型系统 |
| Ant Design | 5.x | UI组件 |
| ECharts | 5.x | 图表渲染 |

---

## 8. 附录

### 8.1 旧版代码参考

**文件**: `开发代码/frontend/js/reports/ConversionFunnelReport.js`

**关键代码段**:
```javascript
// 漏斗层级配置
const funnelStages = [
  { name: '曝光', key: 'impressions' },
  { name: '点击人数', key: 'click_users' },
  { name: '线索人数', key: 'lead_users' },
  { name: '开口人数', key: 'customer_mouth_users' },
  { name: '有效线索', key: 'valid_lead_users' },
  { name: '开户人数', key: 'opened_account_users' },
  { name: '有效户人数', key: 'valid_customer_users' }
];

// 品牌色渐变
const colors = ['#00ABEB', '#009FD5', '#0093BF', '#0087A9', '#007B93', '#006F7D', '#00479D'];
```

### 8.2 相关文档

- 迁移原则: `docs/migration/01-migration-principles.md`
- 页面迁移PRD: `docs/migration/02-pages-migration-prd.md`
- 前端设计规范: `.claude/rules/frontend-design/`

---

**文档维护者**: Claude AI
**最后更新**: 2026-03-13