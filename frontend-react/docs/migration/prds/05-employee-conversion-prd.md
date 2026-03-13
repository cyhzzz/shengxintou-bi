# 员工转化分析页面迁移 PRD

> **版本**: v1.0.0
> **更新时间**: 2026-03-13
> **负责人**: Claude AI

---

## 1. 需求概述

### 1.1 项目背景

将旧版 JavaScript 前端的员工转化分析报表迁移至新版 React + TypeScript 前端，保持功能完全对等。

### 1.2 目标用户

- 销售经理
- 团队主管
- 人力资源
- 管理层

### 1.3 核心目标

1. **数据准确**: 员工转化数据准确展示
2. **分析直观**: 趋势图清晰展示转化走势
3. **排名公平**: 正确计算员工转化排名
4. **筛选灵活**: 支持多维度筛选分析

---

## 2. 功能需求

### 2.1 功能清单

| 功能ID | 功能名称 | 说明 | 优先级 |
|--------|---------|------|--------|
| F001 | 核心指标卡片 | 总线索、总开户、平均开户率、总资产 | P0 |
| F002 | 整体转化走势图 | 周度转化趋势折线图 | P0 |
| F003 | 员工开户转化率走势图 | 各员工转化率趋势对比 | P0 |
| F004 | 排名表格 | 员工转化数据排名 | P0 |
| F005 | 筛选器 | 平台、日期、员工、线索类型 | P0 |
| F006 | 数据导出 | 导出排名CSV | P1 |

### 2.2 功能详细说明

#### F001: 核心指标卡片

**指标列表**:

| 指标名称 | 计算方式 | 格式 |
|---------|---------|------|
| 总线索量 | 所有员工线索数之和 | 数字，千分位 |
| 总开户量 | 所有员工开户数之和 | 数字，千分位 |
| 平均开户率 | 总开户量 / 总线索量 × 100% | 百分比，保留1位小数 |
| 总资产 | 所有员工资产之和 | ¥X,XXX.XX 万 |

**环比显示**:
- 显示与上个周期的环比变化
- 正增长: 绿色箭头 ↑
- 负增长: 红色箭头 ↓

#### F002: 整体转化走势图

**图表类型**: 折线图（周度数据）

**数据维度**:
- X轴: 周次（如 2025-W01）
- Y轴: 转化率（%）

**交互功能**:
- 悬停显示详细数据
- 可切换显示不同指标

#### F003: 员工开户转化率走势图

**图表类型**: 多系列折线图

**数据维度**:
- X轴: 周次
- Y轴: 转化率
- 系列: 各员工（可配置显示数量）

**交互功能**:
- 图例点击切换显示/隐藏
- 悬停显示详细数据

#### F004: 排名表格

**字段列表 (10个)**:

| 字段 | 说明 | 计算方式 | 格式 |
|-----|------|---------|------|
| 排名 | 排名序号 | 按开户率降序 | 数字 |
| 服务人员 | 员工姓名 | - | 字符串 |
| 线索量 | 分配的线索数 | COUNT | 数字 |
| 开口量 | 客户开口数 | COUNT | 数字 |
| 有效线索 | 有效线索数 | COUNT | 数字 |
| 开户量 | 开户数量 | COUNT | 数字 |
| 开户率 | 开户转化率 | 开户量/线索量×100% | 百分比 |
| 有效户 | 有效户数量 | COUNT | 数字 |
| 有效户率 | 有效户转化率 | 有效户/开户量×100% | 百分比 |
| 总资产 | 客户总资产 | SUM | ¥X,XXX.XX 万 |

**表格功能**:
- 按开户率降序排列
- 支持按其他字段排序
- 高亮显示前三名

#### F005: 筛选器

**筛选维度**:

| 筛选项 | 类型 | 数据来源 | 默认值 |
|--------|------|---------|--------|
| 平台 | 多选 | API元数据 | 全选 |
| 日期范围 | 日期范围 | - | 近30天 |
| 员工 | 多选 | API元数据 | 全选 |
| 线索类型 | 单选 | 固定选项 | 全部 |

**线索类型选项**:
- 全部
- 新线索
- 存量线索

---

## 3. 数据需求

### 3.1 API 接口

**获取员工转化分析数据**:
```
POST /api/v1/employee-conversion/analysis
```

**请求参数**:
```typescript
interface EmployeeConversionRequest {
  // 日期范围
  start_date: string;
  end_date: string;

  // 筛选条件
  platforms?: string[];
  employees?: string[];
  lead_type?: 'all' | 'new' | 'existing';

  // 分页（排名表格）
  page?: number;
  page_size?: number;
}
```

**响应数据**:
```typescript
interface EmployeeConversionResponse {
  success: boolean;
  data: {
    // 核心指标
    summary: {
      total_leads: number;
      total_opened: number;
      avg_open_rate: number;
      total_assets: number;
      wow_change?: {
        leads: number;
        opened: number;
        rate: number;
        assets: number;
      };
    };

    // 整体转化走势
    overall_trend: Array<{
      week: string;        // 周次，如 "2025-W01"
      date_range: string;  // 日期范围
      open_rate: number;   // 开户率
    }>;

    // 员工转化率走势
    employee_trend: Array<{
      week: string;
      employees: Array<{
        name: string;
        rate: number;
      }>;
    }>;

    // 排名数据
    ranking: {
      total: number;
      items: Array<{
        rank: number;
        employee_name: string;
        leads: number;
        mouths: number;
        valid_leads: number;
        opened: number;
        open_rate: number;
        valid_customers: number;
        valid_rate: number;
        assets: number;
      }>;
    };
  };
}
```

---

## 4. 前端需求

### 4.1 页面结构

```
src/pages/EmployeeConversion/
├── Analysis.tsx                 # 页面主组件
├── components/
│   ├── FilterBar.tsx           # 筛选器组件
│   ├── MetricCards.tsx         # 指标卡片组件
│   ├── OverallTrendChart.tsx   # 整体走势图
│   ├── EmployeeTrendChart.tsx  # 员工走势图
│   └── RankingTable.tsx        # 排名表格组件
├── hooks/
│   └── useConversionData.ts    # 数据获取Hook
├── types.ts                     # 类型定义
└── index.module.scss           # 样式文件
```

### 4.2 组件设计

#### 主页面组件

```tsx
const EmployeeConversionAnalysis: React.FC = () => {
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const { data, loading, refetch } = useConversionData(filters);

  return (
    <div className={styles.analysisPage}>
      <FilterBar
        filters={filters}
        onChange={setFilters}
        onSearch={refetch}
      />

      <Row gutter={[16, 16]}>
        {/* 核心指标卡片 */}
        <Col span={24}>
          <MetricCards data={data?.summary} loading={loading} />
        </Col>

        {/* 走势图 */}
        <Col xs={24} lg={12}>
          <OverallTrendChart
            data={data?.overall_trend}
            loading={loading}
          />
        </Col>
        <Col xs={24} lg={12}>
          <EmployeeTrendChart
            data={data?.employee_trend}
            loading={loading}
          />
        </Col>

        {/* 排名表格 */}
        <Col span={24}>
          <RankingTable
            data={data?.ranking}
            loading={loading}
            onExport={handleExport}
          />
        </Col>
      </Row>
    </div>
  );
};
```

#### 排名表格组件

```tsx
interface RankingTableProps {
  data?: RankingData;
  loading?: boolean;
  onExport?: () => void;
}

const RankingTable: React.FC<RankingTableProps> = ({
  data,
  loading,
  onExport
}) => {
  const columns: ColumnType<RankingItem>[] = [
    {
      title: '排名',
      dataIndex: 'rank',
      key: 'rank',
      width: 60,
      render: (rank: number) => (
        <span className={rank <= 3 ? styles.topRank : ''}>
          {rank}
        </span>
      ),
    },
    {
      title: '服务人员',
      dataIndex: 'employee_name',
      key: 'employee_name',
      width: 100,
    },
    {
      title: '线索量',
      dataIndex: 'leads',
      key: 'leads',
      width: 80,
      align: 'right',
      sorter: true,
    },
    {
      title: '开户量',
      dataIndex: 'opened',
      key: 'opened',
      width: 80,
      align: 'right',
      sorter: true,
    },
    {
      title: '开户率',
      dataIndex: 'open_rate',
      key: 'open_rate',
      width: 100,
      align: 'right',
      render: (rate: number) => `${rate.toFixed(1)}%`,
      sorter: true,
    },
    // ... 其他列
  ];

  return (
    <Card
      title="员工转化排名"
      extra={
        <Button type="primary" size="small" onClick={onExport}>
          导出
        </Button>
      }
    >
      <Table
        columns={columns}
        dataSource={data?.items}
        loading={loading}
        pagination={{
          total: data?.total,
          pageSize: 20,
        }}
        rowKey="employee_name"
      />
    </Card>
  );
};
```

### 4.3 布局设计

```
┌─────────────────────────────────────────────────────────────┐
│                        筛选器区域                            │
│  [平台多选] [日期范围] [员工多选] [线索类型]  [查询] [重置]  │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                     核心指标卡片 (4个)                       │
│  [总线索量] [总开户量] [平均开户率] [总资产]                │
│    ↑10%      ↑8%         ↑2%        ↑15%                   │
└─────────────────────────────────────────────────────────────┘
┌──────────────────────────┐  ┌───────────────────────────────┐
│   整体转化走势(周度)     │  │  员工开户转化率走势           │
│                          │  │                               │
│   [折线图]              │  │  [多系列折线图]               │
│                          │  │                               │
│   X: 周次               │  │  X: 周次                      │
│   Y: 转化率             │  │  Y: 转化率                    │
│                          │  │  系列: 各员工                 │
└──────────────────────────┘  └───────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                     排名表格                                 │
│  [导出]                                                    │
│  ┌────┬────────┬────────┬────────┬────────┬────────┐       │
│  │排名│服务人员│线索量  │开户量  │开户率  │总资产  │       │
│  ├────┼────────┼────────┼────────┼────────┼────────┤       │
│  │ 1  │ 张三   │ 100   │ 50    │ 50.0% │ ¥500万 │       │
│  │ 2  │ 李四   │ 90    │ 40    │ 44.4% │ ¥400万 │       │
│  │ 3  │ 王五   │ 80    │ 35    │ 43.8% │ ¥350万 │       │
│  └────┴────────┴────────┴────────┴────────┴────────┘       │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. 验收标准

### 5.1 功能验收

| 验收项 | 验收标准 | 通过条件 |
|--------|---------|---------|
| 指标卡片 | 4个指标正确显示 | 环比数据正确 |
| 整体走势图 | 周度数据正确 | 趋势可读 |
| 员工走势图 | 多系列显示正常 | 图例交互正常 |
| 排名表格 | 排名计算正确 | 前三名高亮 |
| 导出功能 | CSV文件正常 | 数据完整 |

### 5.2 API 参数检查清单

- [ ] start_date 参数正确传递
- [ ] end_date 参数正确传递
- [ ] platforms 参数正确传递（数组）
- [ ] employees 参数正确传递（数组）
- [ ] lead_type 参数正确传递（all/new/existing）
- [ ] 分页参数正确传递

### 5.3 计算逻辑验证

**开户率计算**:
```typescript
const openRate = opened / leads * 100;
// 验证: 开户量 / 线索量 × 100%
```

**有效户率计算**:
```typescript
const validRate = validCustomers / opened * 100;
// 验证: 有效户 / 开户量 × 100%
```

**排名逻辑**:
- 主排序: 开户率降序
- 次排序: 总资产降序

---

## 6. 附录

### 6.1 旧版代码参考

**文件**: `开发代码/frontend/js/reports/EmployeeConversionAnalysis.js`

**关键代码段**:
```javascript
// 指标卡片配置
const metricCards = [
  { key: 'total_leads', label: '总线索量', format: 'number' },
  { key: 'total_opened', label: '总开户量', format: 'number' },
  { key: 'avg_open_rate', label: '平均开户率', format: 'percent' },
  { key: 'total_assets', label: '总资产', format: 'currency' },
];

// 排名表格列
const rankingColumns = [
  { title: '排名', dataIndex: 'rank', width: 60 },
  { title: '服务人员', dataIndex: 'employee_name', width: 100 },
  { title: '线索量', dataIndex: 'leads', width: 80 },
  { title: '开户量', dataIndex: 'opened', width: 80 },
  { title: '开户率', dataIndex: 'open_rate', width: 100 },
  // ...
];
```

---

**文档维护者**: Claude AI
**最后更新**: 2026-03-13