# 线索明细页面迁移 PRD

> **版本**: v1.0.0
> **更新时间**: 2026-03-13
> **负责人**: Claude AI

---

## 1. 需求概述

### 1.1 项目背景

将旧版 JavaScript 前端的线索明细报表迁移至新版 React + TypeScript 前端，保持功能完全对等。

### 1.2 目标用户

- 销售人员
- 客服人员
- 数据分析师
- 管理层

### 1.3 核心目标

1. **数据完整性**: 40个字段完整展示
2. **查询效率**: 分页加载，响应快速
3. **操作便捷**: 筛选、搜索、导出功能完善
4. **格式规范**: 各类型字段正确格式化显示

---

## 2. 功能需求

### 2.1 功能清单

| 功能ID | 功能名称 | 说明 | 优先级 |
|--------|---------|------|--------|
| F001 | 数据表格 | 40字段明细数据展示 | P0 |
| F002 | 分页功能 | 50条/页，支持跳页 | P0 |
| F003 | 筛选器 | 日期、平台、代理商筛选 | P0 |
| F004 | 数据导出 | 导出CSV/Excel | P1 |
| F005 | 字段格式化 | 布尔、日期、货币、数值格式化 | P0 |
| F006 | 列排序 | 支持按字段排序 | P1 |
| F007 | 列配置 | 支持显示/隐藏列 | P2 |

### 2.2 功能详细说明

#### F001: 数据表格

**字段列表 (40个)**:

**基本信息 (4个)**:
| 字段 | 显示名称 | 类型 | 格式化 |
|-----|---------|------|--------|
| wechat_nickname | 微信昵称 | 字符串 | - |
| capital_account | 资金账号 | 字符串 | - |
| opening_branch | 开户营业部 | 字符串 | - |
| customer_gender | 客户性别 | 字符串 | - |

**平台和流量信息 (3个)**:
| 字段 | 显示名称 | 类型 | 格式化 |
|-----|---------|------|--------|
| platform_source | 平台来源 | 字符串 | - |
| traffic_type | 流量类型 | 字符串 | - |
| customer_source | 客户来源 | 字符串 | - |

**布尔字段 (8个)**:
| 字段 | 显示名称 | 格式化 |
|-----|---------|--------|
| is_customer_mouth | 是否客户开口 | 是/否 |
| is_valid_lead | 是否有效线索 | 是/否 |
| is_open_account_interrupted | 是否开户中断 | 是/否 |
| is_opened_account | 是否开户 | 是/否 |
| is_valid_customer | 是否为有效户 | 是/否 |
| is_existing_customer | 是否为存量客户 | 是/否 |
| is_existing_valid_customer | 是否为存量有效户 | 是/否 |
| is_delete_enterprise_wechat | 是否删除企微 | 是/否 |

**时间字段 (7个)**:
| 字段 | 显示名称 | 格式化 |
|-----|---------|--------|
| lead_date | 线索日期 | YYYY-MM-DD |
| open_account_interrupted_date | 开户中断日期 | YYYY-MM-DD |
| first_contact_time | 首次触达时间 | YYYY-MM-DD HH:mm |
| last_contact_time | 最近互动时间 | YYYY-MM-DD HH:mm |
| account_opening_time | 开户时间 | YYYY-MM-DD HH:mm |
| wechat_verify_time | 微信认证时间 | YYYY-MM-DD HH:mm |
| valid_customer_time | 有效户时间 | YYYY-MM-DD HH:mm |

**数值字段 (4个)**:
| 字段 | 显示名称 | 格式化 |
|-----|---------|--------|
| interaction_count | 互动次数 | 数字，千分位 |
| sales_interaction_count | 营销人员互动次数 | 数字，千分位 |
| assets | 资产 | ¥X,XXX.XX |
| customer_contribution | 客户贡献 | ¥X,XXX.XX |

**人员信息 (3个)**:
| 字段 | 显示名称 |
|-----|---------|
| add_employee_no | 添加员工号 |
| add_employee_name | 添加员工姓名 |
| wechat_verify_status | 微信认证状态 |

**广告投放信息 (4个)**:
| 字段 | 显示名称 |
|-----|---------|
| ad_account | 广告账号 |
| agency | 广告代理商 |
| ad_id | 广告ID |
| creative_id | 创意ID |

**小红书笔记信息 (2个)**:
| 字段 | 显示名称 |
|-----|---------|
| note_id | 笔记ID |
| note_title | 笔记名称 |

**平台用户信息 (2个)**:
| 字段 | 显示名称 |
|-----|---------|
| platform_user_id | 平台用户ID |
| platform_user_nickname | 平台用户昵称 |

**其他信息 (2个)**:
| 字段 | 显示名称 |
|-----|---------|
| producer | 生产者 |
| enterprise_wechat_tags | 企微标签 |

#### F002: 分页功能

**规格**:
- 每页条数: 50条
- 分页控件: 首页、上一页、页码、下一页、末页
- 跳转功能: 输入页码直接跳转
- 总数显示: 显示总记录数

#### F003: 筛选器

**筛选维度**:

| 筛选项 | 类型 | 数据来源 | 默认值 |
|--------|------|---------|--------|
| 日期范围 | 日期范围选择 | - | 近30天 |
| 平台 | 多选 | API元数据 | 全选 |
| 代理商 | 多选 | API元数据 | 全选 |

#### F004: 数据导出

**导出格式**:
- CSV格式
- Excel格式

**导出内容**:
- 当前筛选条件下的所有数据（非仅当前页）
- 包含所有可见字段

---

## 3. 数据需求

### 3.1 API 接口

**获取线索明细**:
```
GET /api/v1/leads-detail
```

**请求参数**:
```typescript
interface LeadsDetailRequest {
  // 分页参数
  page: number;        // 页码，从1开始
  page_size: number;   // 每页条数，默认50

  // 筛选参数
  start_date?: string; // 开始日期 YYYY-MM-DD
  end_date?: string;   // 结束日期 YYYY-MM-DD
  platforms?: string[]; // 平台列表
  agencies?: string[];  // 代理商列表

  // 排序参数
  sort_field?: string; // 排序字段
  sort_order?: 'asc' | 'desc'; // 排序方向
}
```

**响应数据**:
```typescript
interface LeadsDetailResponse {
  success: boolean;
  data: {
    total: number;              // 总记录数
    page: number;               // 当前页码
    page_size: number;          // 每页条数
    total_pages: number;        // 总页数
    items: LeadsDetailItem[];   // 数据列表
  };
}

interface LeadsDetailItem {
  // 基本信息
  wechat_nickname?: string;
  capital_account?: string;
  opening_branch?: string;
  customer_gender?: string;

  // 平台信息
  platform_source?: string;
  traffic_type?: string;
  customer_source?: string;

  // 布尔字段
  is_customer_mouth?: boolean;
  is_valid_lead?: boolean;
  is_open_account_interrupted?: boolean;
  is_opened_account?: boolean;
  is_valid_customer?: boolean;
  is_existing_customer?: boolean;
  is_existing_valid_customer?: boolean;
  is_delete_enterprise_wechat?: boolean;

  // 时间字段
  lead_date: string;
  open_account_interrupted_date?: string;
  first_contact_time?: string;
  last_contact_time?: string;
  account_opening_time?: string;
  wechat_verify_time?: string;
  valid_customer_time?: string;

  // 数值字段
  interaction_count?: number;
  sales_interaction_count?: number;
  assets?: number;
  customer_contribution?: number;

  // 人员信息
  add_employee_no?: string;
  add_employee_name?: string;
  wechat_verify_status?: string;

  // 广告信息
  ad_account?: string;
  agency?: string;
  ad_id?: string;
  creative_id?: string;

  // 笔记信息
  note_id?: string;
  note_title?: string;

  // 平台用户
  platform_user_id?: string;
  platform_user_nickname?: string;

  // 其他
  producer?: string;
  enterprise_wechat_tags?: string;
}
```

---

## 4. 前端需求

### 4.1 页面结构

```
src/pages/LeadsDetail/
├── index.tsx                    # 页面主组件
├── components/
│   ├── FilterBar.tsx           # 筛选器组件
│   ├── DataTable.tsx           # 数据表格组件
│   ├── Pagination.tsx          # 分页组件
│   └── ExportButton.tsx        # 导出按钮组件
├── hooks/
│   ├── useLeadsData.ts         # 数据获取Hook
│   └── usePagination.ts        # 分页状态Hook
├── types.ts                     # 类型定义
├── columns.tsx                  # 表格列配置
├── formatters.ts               # 字段格式化函数
└── index.module.scss           # 样式文件
```

### 4.2 组件设计

#### 主页面组件

```tsx
const LeadsDetailPage: React.FC = () => {
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    pageSize: 50,
  });

  const { data, loading, refetch } = useLeadsData(filters, pagination);

  return (
    <div className={styles.leadsDetailPage}>
      <FilterBar
        filters={filters}
        onChange={setFilters}
        onSearch={refetch}
      />
      <DataTable
        columns={columns}
        dataSource={data?.items}
        loading={loading}
      />
      <Pagination
        current={pagination.page}
        pageSize={pagination.pageSize}
        total={data?.total}
        onChange={setPagination}
      />
    </div>
  );
};
```

#### 表格列配置

```tsx
// columns.tsx
export const columns: ColumnType<LeadsDetailItem>[] = [
  {
    title: '微信昵称',
    dataIndex: 'wechat_nickname',
    key: 'wechat_nickname',
    width: 120,
  },
  {
    title: '平台来源',
    dataIndex: 'platform_source',
    key: 'platform_source',
    width: 100,
  },
  {
    title: '线索日期',
    dataIndex: 'lead_date',
    key: 'lead_date',
    width: 120,
    sorter: true,
  },
  {
    title: '是否开户',
    dataIndex: 'is_opened_account',
    key: 'is_opened_account',
    width: 100,
    render: (value: boolean) => value ? '是' : '否',
  },
  {
    title: '资产',
    dataIndex: 'assets',
    key: 'assets',
    width: 120,
    align: 'right',
    render: (value: number) => formatCurrency(value),
  },
  // ... 其他列配置
];
```

#### 格式化函数

```tsx
// formatters.ts

/**
 * 格式化货币
 * @param value 数值
 * @returns 格式化后的字符串
 */
export const formatCurrency = (value?: number): string => {
  if (value === undefined || value === null) return '-';
  return `¥${value.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

/**
 * 格式化布尔值
 * @param value 布尔值
 * @returns 是/否
 */
export const formatBoolean = (value?: boolean): string => {
  if (value === undefined || value === null) return '-';
  return value ? '是' : '否';
};

/**
 * 格式化日期
 * @param value 日期字符串
 * @returns YYYY-MM-DD
 */
export const formatDate = (value?: string): string => {
  if (!value) return '-';
  return dayjs(value).format('YYYY-MM-DD');
};

/**
 * 格式化日期时间
 * @param value 日期时间字符串
 * @returns YYYY-MM-DD HH:mm
 */
export const formatDateTime = (value?: string): string => {
  if (!value) return '-';
  return dayjs(value).format('YYYY-MM-DD HH:mm');
};

/**
 * 格式化数字
 * @param value 数值
 * @returns 千分位格式
 */
export const formatNumber = (value?: number): string => {
  if (value === undefined || value === null) return '-';
  return value.toLocaleString('zh-CN');
};
```

### 4.3 布局设计

```
┌─────────────────────────────────────────────────────────────┐
│                        筛选器区域                            │
│  [日期范围选择] [平台多选] [代理商多选]  [查询] [重置] [导出]│
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                        数据统计                              │
│  共 XXXX 条记录                                              │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                        数据表格                              │
│  ┌────┬────────┬────────┬────────┬────────┬────────┐       │
│  │序号│微信昵称│平台来源│线索日期│是否开户│资产    │       │
│  ├────┼────────┼────────┼────────┼────────┼────────┤       │
│  │ 1  │ 张三   │ 腾讯   │2025-01-│   是   │¥10,000 │       │
│  │ 2  │ 李四   │ 抖音   │2025-01-│   否   │   -    │       │
│  └────┴────────┴────────┴────────┴────────┴────────┘       │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                        分页控件                              │
│  [<] 1 2 3 ... 10 [>]  │ 跳转 [__] 页 │ 每页 [50▼] 条      │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. 验收标准

### 5.1 功能验收

| 验收项 | 验收标准 | 通过条件 |
|--------|---------|---------|
| 表格显示 | 所有40字段正确显示 | 数据与后端一致 |
| 分页功能 | 分页正确，可跳页 | 总数计算正确 |
| 筛选功能 | 所有筛选条件生效 | API参数正确 |
| 导出功能 | 导出文件可打开 | 数据完整 |
| 格式化 | 各类型字段格式正确 | 显示规范 |

### 5.2 API 参数检查清单

- [ ] page 参数正确传递（从1开始）
- [ ] page_size 参数正确传递（默认50）
- [ ] start_date 参数格式正确（YYYY-MM-DD）
- [ ] end_date 参数格式正确（YYYY-MM-DD）
- [ ] platforms 参数正确传递（数组）
- [ ] agencies 参数正确传递（数组）

### 5.3 性能验收

| 指标 | 标准 |
|-----|------|
| 首屏加载时间 | < 2s |
| 分页切换时间 | < 500ms |
| 表格渲染时间 | < 1s |

---

## 6. 附录

### 6.1 旧版代码参考

**文件**: `开发代码/frontend/js/reports/LeadsDetailReport.js`

**关键代码段**:
```javascript
// 字段定义
const fields = [
  { key: 'wechat_nickname', label: '微信昵称', type: 'string' },
  { key: 'is_opened_account', label: '是否开户', type: 'boolean' },
  { key: 'assets', label: '资产', type: 'currency' },
  // ...
];

// 格式化函数
function formatValue(value, type) {
  switch (type) {
    case 'boolean':
      return value ? '是' : '否';
    case 'currency':
      return `¥${value.toLocaleString()}`;
    case 'date':
      return formatDate(value);
    default:
      return value;
  }
}
```

---

**文档维护者**: Claude AI
**最后更新**: 2026-03-13