# 厂商分析页面迁移实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将原生JS版本的厂商分析页面完整迁移至React前端，实现独立筛选器、趋势图、数据表格、对比分析功能

**Architecture:** React组件化架构，使用AgencyFilterBar代理商筛选器、ChartCard图表卡片、DataTable数据表格组件，支持指标切换和粒度切换

**Tech Stack:** React 19, TypeScript 5, Ant Design, ECharts/@ant-design/charts, Zustand, SCSS Modules

---

## ⚠️ 迁移前必读：常见问题检查清单

### 1. API参数完整性检查

| 参数名 | 是否必需 | 默认值 | 说明 |
|--------|---------|--------|------|
| `start_date` | ✅ 是 | - | 开始日期 |
| `end_date` | ✅ 是 | - | 结束日期 |
| `platforms` | ❌ 否 | [] | 平台筛选 |
| `business_models` | ❌ 否 | [] | 业务模式筛选 |
| `agencies` | ❌ 否 | [] | 代理商筛选 |

### 2. 筛选器独立性验证

- [ ] 使用独立筛选器（AgencyFilterBar）
- [ ] 筛选器初始化时不自动触发查询
- [ ] 默认显示"全部"选项
- [ ] 用户点击"查询"才执行

### 3. 趋势图功能验证

- [ ] 支持指标切换（花费/曝光/点击/线索/开户）
- [ ] 支持粒度切换（日/周/月）
- [ ] 图表标题正确显示
- [ ] Tooltip格式化正确

### 4. 数据表格验证

- [ ] 支持按平台+代理商聚合
- [ ] 支持排序
- [ ] 显示合计行

---

## Task 1: 创建类型定义

**Files:**
- Modify: `src/types/api.schemas.ts`

**Step 1: 添加厂商分析API类型**

```typescript
// 在 src/types/api.schemas.ts 中添加

/**
 * 厂商分析API请求参数
 */
export interface PostAgencyAnalysisBody {
  start_date: string;
  end_date: string;
  platforms?: string[];
  business_models?: string[];
  agencies?: string[];
}

/**
 * 厂商分析汇总数据项
 */
export interface AgencyAnalysisItem {
  platform: string;
  agency: string;
  business_model: string;
  cost: number;
  impressions: number;
  clicks: number;
  lead_users: number;
  customer_mouth_users: number;
  valid_lead_users: number;
  opened_account_users: number;
  valid_customer_users: number;
  cost_per_lead: number;
  cost_per_account: number;
}

/**
 * 厂商分析趋势数据
 */
export interface AgencyTrendData {
  dates: string[];
  series: {
    name: string;
    data: number[];
  }[];
}

/**
 * 厂商分析API响应
 */
export interface AgencyAnalysisResponse {
  summary: AgencyAnalysisItem[];
  trend: AgencyTrendData;
  comparison?: {
    previous_period: AgencyAnalysisItem[];
  };
}
```

**Step 2: 验证类型定义**

运行: `npm run type-check`
预期: 无类型错误

---

## Task 2: 创建API调用Hook

**Files:**
- Create: `src/pages/AgencyAnalysis/hooks/useAgencyAnalysis.ts`

**Step 1: 编写useAgencyAnalysis Hook**

```typescript
import { useState, useCallback } from 'react';
import { apiClient } from '@/utils/api';
import type { PostAgencyAnalysisBody, AgencyAnalysisResponse, AgencyAnalysisItem, AgencyTrendData } from '@/types/api.schemas';

interface UseAgencyAnalysisReturn {
  summary: AgencyAnalysisItem[];
  trend: AgencyTrendData | null;
  loading: boolean;
  error: string | null;
  fetchData: (params: PostAgencyAnalysisBody) => Promise<void>;
}

export function useAgencyAnalysis(): UseAgencyAnalysisReturn {
  const [summary, setSummary] = useState<AgencyAnalysisItem[]>([]);
  const [trend, setTrend] = useState<AgencyTrendData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (params: PostAgencyAnalysisBody) => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.post<AgencyAnalysisResponse>(
        '/api/v1/agency-analysis',
        params
      );

      setSummary(response.summary || []);
      setTrend(response.trend || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取厂商分析数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  return { summary, trend, loading, error, fetchData };
}
```

**Step 2: 验证Hook功能**

运行: `npm run type-check`
预期: 无类型错误

---

## Task 3: 创建筛选器Hook

**Files:**
- Create: `src/pages/AgencyAnalysis/hooks/useAgencyFilters.ts`

**Step 1: 编写useAgencyFilters Hook**

```typescript
import { useState, useCallback } from 'react';
import type { PostAgencyAnalysisBody } from '@/types/api.schemas';

interface AgencyFilters {
  start_date: string;
  end_date: string;
  platforms: string[];
  business_models: string[];
  agencies: string[];
}

interface UseAgencyFiltersReturn {
  filters: AgencyFilters;
  updateFilters: (newFilters: Partial<AgencyFilters>) => void;
  resetFilters: () => void;
  getApiParams: () => PostAgencyAnalysisBody;
}

const DEFAULT_FILTERS: AgencyFilters = {
  start_date: '',
  end_date: '',
  platforms: [],
  business_models: [],
  agencies: [],
};

export function useAgencyFilters(): UseAgencyFiltersReturn {
  const [filters, setFilters] = useState<AgencyFilters>(DEFAULT_FILTERS);

  const updateFilters = useCallback((newFilters: Partial<AgencyFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const getApiParams = useCallback((): PostAgencyAnalysisBody => {
    const params: PostAgencyAnalysisBody = {
      start_date: filters.start_date,
      end_date: filters.end_date,
    };

    if (filters.platforms.length > 0) {
      params.platforms = filters.platforms;
    }
    if (filters.business_models.length > 0) {
      params.business_models = filters.business_models;
    }
    if (filters.agencies.length > 0) {
      params.agencies = filters.agencies;
    }

    return params;
  }, [filters]);

  return { filters, updateFilters, resetFilters, getApiParams };
}
```

**Step 2: 验证Hook功能**

运行: `npm run type-check`
预期: 无类型错误

---

## Task 4: 创建趋势图组件

**Files:**
- Create: `src/pages/AgencyAnalysis/components/AgencyTrendChart.tsx`
- Create: `src/pages/AgencyAnalysis/components/AgencyTrendChart.module.scss`

**Step 1: 编写趋势图组件**

```typescript
/**
 * 厂商分析趋势图组件
 * 支持指标切换和粒度切换
 */
import React, { useState } from 'react';
import { Line } from '@ant-design/charts';
import { Radio, Space, Spin, Empty, Segmented } from 'antd';
import type { AgencyTrendData } from '@/types/api.schemas';
import styles from './AgencyTrendChart.module.scss';

export type MetricType = 'cost' | 'impressions' | 'clicks' | 'lead_users' | 'opened_account_users';
export type GranularityType = 'daily' | 'weekly' | 'monthly';

interface AgencyTrendChartProps {
  data: AgencyTrendData | null;
  loading?: boolean;
  height?: number;
  onGranularityChange?: (granularity: GranularityType) => void;
}

const METRIC_LABELS: Record<MetricType, string> = {
  cost: '花费',
  impressions: '曝光',
  clicks: '点击',
  lead_users: '线索',
  opened_account_users: '开户',
};

const GRANULARITY_LABELS: Record<GranularityType, string> = {
  daily: '日',
  weekly: '周',
  monthly: '月',
};

const AgencyTrendChart: React.FC<AgencyTrendChartProps> = ({
  data,
  loading = false,
  height = 350,
  onGranularityChange,
}) => {
  const [metric, setMetric] = useState<MetricType>('cost');
  const [granularity, setGranularity] = useState<GranularityType>('daily');

  const handleMetricChange = (value: MetricType) => {
    setMetric(value);
  };

  const handleGranularityChange = (value: GranularityType) => {
    setGranularity(value);
    onGranularityChange?.(value);
  };

  // 转换数据格式
  const chartData = React.useMemo(() => {
    if (!data || !data.dates || !data.series) return [];

    const seriesItem = data.series.find(s => s.name === METRIC_LABELS[metric]);
    if (!seriesItem) return [];

    return data.dates.map((date, index) => ({
      date,
      value: seriesItem.data[index] || 0,
      category: METRIC_LABELS[metric],
    }));
  }, [data, metric]);

  const config = {
    data: chartData,
    xField: 'date',
    yField: 'value',
    seriesField: 'category',
    smooth: true,
    animation: {
      appear: {
        animation: 'path-in',
        duration: 1000,
      },
    },
    point: {
      shape: 'circle',
      size: 4,
    },
    tooltip: {
      formatter: (datum: any) => ({
        name: datum.category,
        value: metric === 'cost'
          ? `¥${datum.value?.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`
          : datum.value?.toLocaleString(),
      }),
    },
    yAxis: {
      label: {
        formatter: (value: number) => metric === 'cost' ? `¥${value.toLocaleString()}` : value.toLocaleString(),
      },
    },
    xAxis: {
      label: {
        autoRotate: true,
        autoHide: true,
      },
    },
    color: ['#1890ff'],
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer} style={{ height }}>
        <Spin />
      </div>
    );
  }

  if (!data || !data.dates || data.dates.length === 0) {
    return (
      <div className={styles.emptyContainer} style={{ height }}>
        <Empty description="暂无数据" />
      </div>
    );
  }

  return (
    <div className={styles.trendChart}>
      <div className={styles.chartControls}>
        <Space size="middle">
          {/* 指标切换 */}
          <div className={styles.controlGroup}>
            <span className={styles.controlLabel}>指标:</span>
            <Segmented
              value={metric}
              onChange={(value) => handleMetricChange(value as MetricType)}
              options={Object.entries(METRIC_LABELS).map(([key, label]) => ({
                label,
                value: key,
              }))}
            />
          </div>

          {/* 粒度切换 */}
          {onGranularityChange && (
            <div className={styles.controlGroup}>
              <span className={styles.controlLabel}>粒度:</span>
              <Segmented
                value={granularity}
                onChange={(value) => handleGranularityChange(value as GranularityType)}
                options={Object.entries(GRANULARITY_LABELS).map(([key, label]) => ({
                  label,
                  value: key,
                }))}
              />
            </div>
          )}
        </Space>
      </div>

      <div style={{ height }}>
        <Line {...config} />
      </div>
    </div>
  );
};

export default AgencyTrendChart;
```

**Step 2: 编写样式文件**

```scss
// AgencyTrendChart.module.scss
.trendChart {
  .chartControls {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 16px;
  }

  .controlGroup {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .controlLabel {
    font-size: 14px;
    color: #666;
  }
}

.loadingContainer,
.emptyContainer {
  display: flex;
  align-items: center;
  justify-content: center;
}

// 响应式
@media (max-width: 768px) {
  .chartControls {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .controlGroup {
    width: 100%;
  }
}
```

**Step 3: 验证组件**

运行: `npm run type-check`
预期: 无类型错误

---

## Task 5: 创建数据表格列配置

**Files:**
- Create: `src/pages/AgencyAnalysis/config/tableColumns.tsx`

**Step 1: 编写表格列配置**

```typescript
import React from 'react';
import type { ColumnsType } from 'antd/es/table';
import type { AgencyAnalysisItem } from '@/types/api.schemas';

/**
 * 厂商分析表格列配置
 */
export const getTableColumns = (): ColumnsType<AgencyAnalysisItem> => [
  {
    title: '平台',
    dataIndex: 'platform',
    key: 'platform',
    width: 80,
    fixed: 'left',
    filters: [
      { text: '腾讯', value: '腾讯' },
      { text: '抖音', value: '抖音' },
      { text: '小红书', value: '小红书' },
    ],
  },
  {
    title: '代理商',
    dataIndex: 'agency',
    key: 'agency',
    width: 100,
  },
  {
    title: '业务模式',
    dataIndex: 'business_model',
    key: 'business_model',
    width: 100,
    filters: [
      { text: '直播', value: '直播' },
      { text: '信息流', value: '信息流' },
      { text: '搜索', value: '搜索' },
    ],
  },
  {
    title: '花费',
    dataIndex: 'cost',
    key: 'cost',
    width: 120,
    align: 'right',
    sorter: true,
    render: (value: number) => `¥${value?.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`,
  },
  {
    title: '曝光',
    dataIndex: 'impressions',
    key: 'impressions',
    width: 100,
    align: 'right',
    sorter: true,
    render: (value: number) => value?.toLocaleString(),
  },
  {
    title: '点击',
    dataIndex: 'clicks',
    key: 'clicks',
    width: 80,
    align: 'right',
    sorter: true,
    render: (value: number) => value?.toLocaleString(),
  },
  {
    title: '线索人数',
    dataIndex: 'lead_users',
    key: 'lead_users',
    width: 90,
    align: 'right',
    sorter: true,
    render: (value: number) => value?.toLocaleString(),
  },
  {
    title: '开户人数',
    dataIndex: 'opened_account_users',
    key: 'opened_account_users',
    width: 90,
    align: 'right',
    sorter: true,
    render: (value: number) => value?.toLocaleString(),
  },
  {
    title: '有效户',
    dataIndex: 'valid_customer_users',
    key: 'valid_customer_users',
    width: 80,
    align: 'right',
    sorter: true,
    render: (value: number) => value?.toLocaleString(),
  },
  {
    title: '线索成本',
    dataIndex: 'cost_per_lead',
    key: 'cost_per_lead',
    width: 100,
    align: 'right',
    sorter: true,
    render: (value: number) => value ? `¥${value.toFixed(2)}` : '-',
  },
  {
    title: '开户成本',
    dataIndex: 'cost_per_account',
    key: 'cost_per_account',
    width: 100,
    align: 'right',
    sorter: true,
    render: (value: number) => value ? `¥${value.toFixed(2)}` : '-',
  },
];
```

**Step 2: 验证配置**

运行: `npm run type-check`
预期: 无类型错误

---

## Task 6: 创建主页面组件

**Files:**
- Modify: `src/pages/AgencyAnalysis/index.tsx`
- Create: `src/pages/AgencyAnalysis/index.module.scss`
- Create: `src/pages/AgencyAnalysis/hooks/index.ts`

**Step 1: 导出Hooks**

```typescript
// src/pages/AgencyAnalysis/hooks/index.ts
export { useAgencyAnalysis } from './useAgencyAnalysis';
export { useAgencyFilters } from './useAgencyFilters';
```

**Step 2: 编写主页面组件**

```typescript
/**
 * 厂商分析页面
 * 按代理商维度分析投放和转化数据
 */
import React, { useEffect, useState, useCallback } from 'react';
import { Card, Table, Row, Col, Statistic, Typography } from 'antd';
import { DollarOutlined, EyeOutlined, UserOutlined, TeamOutlined } from '@ant-design/icons';
import AgencyTrendChart from './components/AgencyTrendChart';
import { getTableColumns } from './config/tableColumns';
import { useAgencyAnalysis, useAgencyFilters } from './hooks';
import { FilterBar } from '@/components';
import { useMetadata } from '@/hooks/useMetadata';
import type { GranularityType } from './components/AgencyTrendChart';
import styles from './index.module.scss';

const { Title } = Typography;

const AgencyAnalysisPage: React.FC = () => {
  const [granularity, setGranularity] = useState<GranularityType>('daily');

  const { metadata, loading: metadataLoading } = useMetadata();
  const { filters, updateFilters, resetFilters, getApiParams } = useAgencyFilters();
  const { summary, trend, loading, error, fetchData } = useAgencyAnalysis();

  // 初始加载
  useEffect(() => {
    // 设置默认日期范围
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    updateFilters({
      start_date: thirtyDaysAgo.toISOString().split('T')[0],
      end_date: today.toISOString().split('T')[0],
    });

    // 加载初始数据（全量）
    fetchData({
      start_date: thirtyDaysAgo.toISOString().split('T')[0],
      end_date: today.toISOString().split('T')[0],
    });
  }, []);

  // 加载数据
  const loadData = useCallback(() => {
    const params = getApiParams();
    if (params.start_date && params.end_date) {
      fetchData(params);
    }
  }, [getApiParams, fetchData]);

  // 筛选器查询
  const handleSearch = useCallback((searchFilters: {
    startDate: string;
    endDate: string;
    platforms: string[];
    agencies: string[];
    businessModels: string[];
  }) => {
    updateFilters({
      start_date: searchFilters.startDate,
      end_date: searchFilters.endDate,
      platforms: searchFilters.platforms,
      agencies: searchFilters.agencies,
      business_models: searchFilters.businessModels,
    });
    loadData();
  }, [updateFilters, loadData]);

  // 筛选器重置
  const handleReset = useCallback(() => {
    resetFilters();
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    updateFilters({
      start_date: thirtyDaysAgo.toISOString().split('T')[0],
      end_date: today.toISOString().split('T')[0],
    });
    loadData();
  }, [resetFilters, updateFilters, loadData]);

  // 粒度变化
  const handleGranularityChange = useCallback((newGranularity: GranularityType) => {
    setGranularity(newGranularity);
    // 重新加载数据
    loadData();
  }, [loadData]);

  // 计算汇总数据
  const totalCost = summary.reduce((sum, item) => sum + (item.cost || 0), 0);
  const totalLeads = summary.reduce((sum, item) => sum + (item.lead_users || 0), 0);
  const totalAccounts = summary.reduce((sum, item) => sum + (item.opened_account_users || 0), 0);
  const totalValidCustomers = summary.reduce((sum, item) => sum + (item.valid_customer_users || 0), 0);

  // 表格列
  const columns = getTableColumns();

  return (
    <div className={styles.agencyAnalysisPage}>
      {/* 筛选器 */}
      <FilterBar
        showPlatform
        showAgency
        showBusinessModel
        onSearch={handleSearch}
        onReset={handleReset}
      />

      {/* 汇总统计 */}
      <Row gutter={16} className={styles.summaryRow}>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="总花费"
              value={totalCost}
              precision={2}
              prefix={<DollarOutlined />}
              formatter={(value) => `¥${Number(value).toLocaleString()}`}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="总线索"
              value={totalLeads}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="总开户"
              value={totalAccounts}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="有效户"
              value={totalValidCustomers}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 趋势图 */}
      <Card className={styles.chartCard}>
        <Title level={4}>趋势分析</Title>
        <AgencyTrendChart
          data={trend}
          loading={loading}
          height={350}
          onGranularityChange={handleGranularityChange}
        />
      </Card>

      {/* 数据表格 */}
      <Card className={styles.tableCard}>
        <Title level={4}>代理商数据</Title>
        <Table
          columns={columns}
          dataSource={summary}
          rowKey={(record) => `${record.platform}-${record.agency}-${record.business_model}`}
          loading={loading}
          scroll={{ x: 1200 }}
          pagination={{
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
          summary={() => (
            <Table.Summary fixed>
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={3}>
                  <strong>合计</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={3} align="right">
                  <strong>¥{totalCost.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={4} align="right">
                  <strong>{totalLeads.toLocaleString()}</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={5} align="right">
                  <strong>{totalAccounts.toLocaleString()}</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={6} align="right">
                  <strong>{totalValidCustomers.toLocaleString()}</strong>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            </Table.Summary>
          )}
        />
      </Card>
    </div>
  );
};

export default AgencyAnalysisPage;
```

**Step 3: 编写样式文件**

```scss
// index.module.scss
.agencyAnalysisPage {
  padding: 20px;
}

.summaryRow {
  margin-bottom: 20px;

  .ant-card {
    border-radius: 8px;
  }
}

.chartCard,
.tableCard {
  margin-bottom: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);

  h4 {
    margin-bottom: 16px;
  }
}
```

**Step 4: 验证页面组件**

运行: `npm run type-check`
预期: 无类型错误

---

## Task 7: 注册路由

**Files:**
- Modify: `src/router/index.tsx`

**Step 1: 添加路由配置**

```typescript
import AgencyAnalysisPage from '@/pages/AgencyAnalysis';

// 在路由配置中添加
{
  path: '/agency-analysis',
  element: <AgencyAnalysisPage />,
  meta: {
    title: '厂商分析',
    icon: 'ShopOutlined',
  },
}
```

**Step 2: 验证路由**

运行: `npm run dev`
访问: `http://localhost:5173/agency-analysis`
预期: 页面正常渲染

---

## Task 8: 功能验证

**Step 1: 验证筛选器独立性**

- [ ] 使用独立筛选器
- [ ] 初始化时不自动查询
- [ ] 点击查询才执行

**Step 2: 验证趋势图功能**

- [ ] 指标切换正常
- [ ] 粒度切换正常
- [ ] Tooltip格式正确

**Step 3: 验证数据表格**

- [ ] 排序功能正常
- [ ] 合计行显示正确
- [ ] 分页功能正常

**Step 4: 验证汇总统计**

- [ ] 数据计算正确
- [ ] 格式化显示正确

---

## Task 9: 提交代码

```bash
git add src/pages/AgencyAnalysis src/types/api.schemas.ts src/router/index.tsx
git commit -m "feat: 迁移厂商分析页面至React前端

- 添加厂商分析API类型定义
- 创建useAgencyAnalysis和useAgencyFilters自定义Hooks
- 实现趋势图组件，支持指标和粒度切换
- 实现数据表格，支持排序和合计行
- 添加汇总统计卡片

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## 验收标准

- [ ] 筛选器独立且不自动查询
- [ ] 趋势图指标和粒度切换正常
- [ ] 数据表格排序和分页正常
- [ ] 汇总统计计算正确
- [ ] 响应式布局正常
- [ ] 无TypeScript编译错误

---

**最后更新**: 2026-03-13
**维护者**: Claude AI