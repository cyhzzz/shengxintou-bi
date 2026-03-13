# 数据概览页迁移文档

> **模块**: Dashboard (数据概览)
> **版本**: v1.0.0
> **更新时间**: 2026-03-12
> **状态**: 准备迁移

---

## 概述

本文档描述如何将原有的 JavaScript 数据概览页 (`DashboardReport.js`) 迁移到 React + TypeScript 架构。

### 迁移目标

1. 创建类型安全的 React 组件
2. 使用自动生成的 TypeScript 类型
3. 保持原有功能完整性
4. 优化代码结构和可维护性

---

## 后端 API 接口

### 1. 获取核心指标

**接口**: `POST /api/v1/dashboard/core-metrics`

**请求参数**:
```typescript
interface PostDashboardCoreMetricsBody {
  start_date?: string;      // 开始日期 (YYYY-MM-DD)
  end_date?: string;        // 结束日期 (YYYY-MM-DD)
  platforms?: string[];     // 平台筛选 ['腾讯', '抖音', '小红书']
  agencies?: string[];      // 代理商筛选
  business_models?: string[]; // 业务模式筛选 ['直播', '信息流', '搜索']
}
```

**响应类型**:
```typescript
type CoreMetricsResponse = SuccessResponse & {
  data?: {
    core_metrics?: CoreMetrics;
    wow_changes?: WowChange;
  };
};

interface CoreMetrics {
  investment?: number;           // 总投入（元）
  total_impressions?: number;    // 总曝光数
  total_clicks?: number;         // 总点击数
  total_leads?: number;          // 总线索数
  new_customers?: number;        // 新开客户数
  new_valid_accounts?: number;   // 新有效户数
  cost_per_lead?: number;        // 线索成本
  cost_per_valid_account?: number; // 有效户成本
  customer_assets?: number;      // 新客户资产
  customer_contribution?: number; // 客户贡献
  existing_customers_assets?: number; // 存量客户资产
}

interface WowChange {
  [key: string]: {
    value?: number;   // 变化百分比
    trend?: 'up' | 'down' | 'flat'; // 趋势方向
    color?: 'green' | 'red'; // 显示颜色
  };
}
```

### 2. 获取趋势数据

**接口**: `POST /api/v1/dashboard/trend-data`

**请求参数**:
```typescript
interface PostDashboardTrendDataBody {
  start_date: string;        // 开始日期 (必需)
  end_date: string;          // 结束日期 (必需)
  platforms?: string[];
  agencies?: string[];
  business_models?: string[];
  metric_type?: 'cost_per_lead' | 'cost_per_customer' | 'cost_per_valid_account'; // 默认: cost_per_lead
}
```

**响应类型**:
```typescript
type DashboardTrendDataResponse = SuccessResponse & {
  data?: {
    dates?: string[];  // 日期数组
    values?: number[]; // 指标值数组
    metric_type?: 'cost_per_lead' | 'cost_per_customer' | 'cost_per_valid_account';
  };
};
```

### 3. 获取账号列表

**接口**: `POST /api/v1/dashboard/accounts`

**请求参数**:
```typescript
interface PostDashboardAccountsBody {
  filters?: {
    platforms?: string[];
    agencies?: string[];
  };
}
```

**响应类型**:
```typescript
type DashboardAccountsResponse = SuccessResponse & {
  data?: {
    accounts?: string[];
  };
};
```

---

## API 调用封装

### 使用自动生成的 API 函数

```typescript
import {
  postDashboardCoreMetrics,
  postDashboardTrendData,
  postDashboardAccounts
} from '@/types/api';

// 获取核心指标
const fetchCoreMetrics = async (params: PostDashboardCoreMetricsBody) => {
  const response = await postDashboardCoreMetrics(params);
  if (response.success && response.data) {
    return {
      coreMetrics: response.data.core_metrics,
      wowChanges: response.data.wow_changes
    };
  }
  throw new Error(response.message || '获取核心指标失败');
};

// 获取趋势数据
const fetchTrendData = async (params: PostDashboardTrendDataBody) => {
  const response = await postDashboardTrendData(params);
  if (response.success && response.data) {
    return response.data;
  }
  throw new Error(response.message || '获取趋势数据失败');
};
```

---

## 组件结构设计

### 文件结构

```
src/pages/Dashboard/
├── index.tsx                 # 主组件入口
├── Dashboard.tsx             # 数据概览主组件
├── components/
│   ├── MetricCard.tsx        # 指标卡片组件
│   ├── WowChangeIndicator.tsx # 环比变化指示器
│   ├── TrendChart.tsx        # 趋势图组件
│   ├── PlatformDistribution.tsx # 平台分布图
│   └── FilterBar.tsx         # 筛选器组件
├── hooks/
│   ├── useCoreMetrics.ts     # 核心指标数据 Hook
│   ├── useTrendData.ts       # 趋势数据 Hook
│   └── useDashboardFilters.ts # 筛选状态 Hook
├── types/
│   └── index.ts              # 本地类型定义（扩展 API 类型）
└── styles/
    └── dashboard.scss        # 样式文件
```

---

## 组件实现

### 1. 主组件 (Dashboard.tsx)

```tsx
import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Spin, message } from 'antd';
import { useCoreMetrics } from './hooks/useCoreMetrics';
import { useTrendData } from './hooks/useTrendData';
import { useDashboardFilters } from './hooks/useDashboardFilters';
import MetricCard from './components/MetricCard';
import TrendChart from './components/TrendChart';
import FilterBar from './components/FilterBar';
import type { CoreMetrics, WowChange } from '@/types/api.schemas';

const Dashboard: React.FC = () => {
  const { filters, updateFilters } = useDashboardFilters();
  const { coreMetrics, wowChanges, loading: metricsLoading, error: metricsError } = useCoreMetrics(filters);
  const { trendData, loading: trendLoading, error: trendError } = useTrendData(filters);

  useEffect(() => {
    if (metricsError) {
      message.error('获取核心指标失败');
    }
    if (trendError) {
      message.error('获取趋势数据失败');
    }
  }, [metricsError, trendError]);

  return (
    <div className="dashboard-page">
      {/* 筛选器 */}
      <FilterBar filters={filters} onChange={updateFilters} />

      {/* 指标卡片 */}
      <Spin spinning={metricsLoading}>
        <Row gutter={[16, 16]} className="metrics-row">
          <Col xs={24} sm={12} lg={8} xl={6}>
            <MetricCard
              title="总投入"
              value={coreMetrics?.investment}
              wowChange={wowChanges?.investment}
              prefix="¥"
              formatter="currency"
            />
          </Col>
          <Col xs={24} sm={12} lg={8} xl={6}>
            <MetricCard
              title="总曝光"
              value={coreMetrics?.total_impressions}
              wowChange={wowChanges?.total_impressions}
              formatter="number"
            />
          </Col>
          <Col xs={24} sm={12} lg={8} xl={6}>
            <MetricCard
              title="总点击"
              value={coreMetrics?.total_clicks}
              wowChange={wowChanges?.total_clicks}
              formatter="number"
            />
          </Col>
          <Col xs={24} sm={12} lg={8} xl={6}>
            <MetricCard
              title="总线索"
              value={coreMetrics?.total_leads}
              wowChange={wowChanges?.total_leads}
              formatter="number"
            />
          </Col>
          <Col xs={24} sm={12} lg={8} xl={6}>
            <MetricCard
              title="新开客户"
              value={coreMetrics?.new_customers}
              wowChange={wowChanges?.new_customers}
              formatter="number"
            />
          </Col>
          <Col xs={24} sm={12} lg={8} xl={6}>
            <MetricCard
              title="新有效户"
              value={coreMetrics?.new_valid_accounts}
              wowChange={wowChanges?.new_valid_accounts}
              formatter="number"
            />
          </Col>
          <Col xs={24} sm={12} lg={8} xl={6}>
            <MetricCard
              title="线索成本"
              value={coreMetrics?.cost_per_lead}
              wowChange={wowChanges?.cost_per_lead}
              prefix="¥"
              formatter="currency"
              inverseTrend // 成本越低越好
            />
          </Col>
          <Col xs={24} sm={12} lg={8} xl={6}>
            <MetricCard
              title="有效户成本"
              value={coreMetrics?.cost_per_valid_account}
              wowChange={wowChanges?.cost_per_valid_account}
              prefix="¥"
              formatter="currency"
              inverseTrend
            />
          </Col>
        </Row>
      </Spin>

      {/* 客户资产卡片 */}
      <Spin spinning={metricsLoading}>
        <Row gutter={[16, 16]} className="assets-row">
          <Col xs={24} sm={8}>
            <MetricCard
              title="新客户资产"
              value={coreMetrics?.customer_assets}
              wowChange={wowChanges?.customer_assets}
              prefix="¥"
              formatter="currency"
              variant="asset"
            />
          </Col>
          <Col xs={24} sm={8}>
            <MetricCard
              title="客户贡献"
              value={coreMetrics?.customer_contribution}
              wowChange={wowChanges?.customer_contribution}
              prefix="¥"
              formatter="currency"
              variant="asset"
            />
          </Col>
          <Col xs={24} sm={8}>
            <MetricCard
              title="存量客户资产"
              value={coreMetrics?.existing_customers_assets}
              wowChange={wowChanges?.existing_customers_assets}
              prefix="¥"
              formatter="currency"
              variant="asset"
            />
          </Col>
        </Row>
      </Spin>

      {/* 趋势图 */}
      <Card title="成本趋势" className="trend-card">
        <Spin spinning={trendLoading}>
          <TrendChart
            dates={trendData?.dates || []}
            values={trendData?.values || []}
            metricType={trendData?.metric_type}
          />
        </Spin>
      </Card>
    </div>
  );
};

export default Dashboard;
```

### 2. 指标卡片组件 (MetricCard.tsx)

```tsx
import React from 'react';
import { Card, Statistic, Tooltip } from 'antd';
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  MinusOutlined
} from '@ant-design/icons';
import type { WowChangeColor, WowChangeTrend } from '@/types/api.schemas';

interface WowChangeValue {
  value?: number;
  trend?: WowChangeTrend;
  color?: WowChangeColor;
}

interface MetricCardProps {
  title: string;
  value?: number;
  wowChange?: WowChangeValue;
  prefix?: string;
  suffix?: string;
  formatter?: 'number' | 'currency' | 'percent';
  inverseTrend?: boolean; // 成本类指标，下降为正向
  variant?: 'default' | 'asset';
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  wowChange,
  prefix,
  suffix,
  formatter = 'number',
  inverseTrend = false,
  variant = 'default'
}) => {
  const formatValue = (val?: number): string => {
    if (val === undefined || val === null) return '-';

    switch (formatter) {
      case 'currency':
        return val.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      case 'percent':
        return `${val.toFixed(2)}%`;
      default:
        return val.toLocaleString('zh-CN');
    }
  };

  const getTrendIcon = (trend?: WowChangeTrend) => {
    switch (trend) {
      case 'up':
        return <ArrowUpOutlined />;
      case 'down':
        return <ArrowDownOutlined />;
      default:
        return <MinusOutlined />;
    }
  };

  const getTrendColor = (color?: WowChangeColor) => {
    return color === 'green' ? '#52c41a' : '#f5222d';
  };

  const renderWowChange = () => {
    if (!wowChange || wowChange.value === undefined) return null;

    const isPositiveDisplay = wowChange.color === 'green';

    return (
      <Tooltip title="环比变化">
        <div className="wow-change" style={{ color: getTrendColor(wowChange.color) }}>
          {getTrendIcon(wowChange.trend)}
          <span>{Math.abs(wowChange.value).toFixed(2)}%</span>
        </div>
      </Tooltip>
    );
  };

  return (
    <Card
      className={`metric-card metric-card--${variant}`}
      hoverable
    >
      <div className="metric-card__content">
        <div className="metric-card__title">{title}</div>
        <div className="metric-card__value">
          {prefix}
          {formatValue(value)}
          {suffix}
        </div>
        {renderWowChange()}
      </div>
    </Card>
  );
};

export default MetricCard;
```

### 3. 环比变化指示器组件 (WowChangeIndicator.tsx)

```tsx
import React from 'react';
import { Tag, Tooltip } from 'antd';
import {
  ArrowUpOutlined,
  ArrowDownOutlined
} from '@ant-design/icons';
import type { WowChangeColor, WowChangeTrend } from '@/types/api.schemas';

interface WowChangeIndicatorProps {
  value?: number;
  trend?: WowChangeTrend;
  color?: WowChangeColor;
  showTooltip?: boolean;
}

const WowChangeIndicator: React.FC<WowChangeIndicatorProps> = ({
  value,
  trend,
  color,
  showTooltip = true
}) => {
  if (value === undefined) return null;

  const isUp = trend === 'up';
  const isGreen = color === 'green';

  const tagColor = isGreen ? 'success' : 'error';
  const Icon = isUp ? ArrowUpOutlined : ArrowDownOutlined;

  const content = (
    <Tag color={tagColor} icon={<Icon />}>
      {Math.abs(value).toFixed(2)}%
    </Tag>
  );

  if (showTooltip) {
    return (
      <Tooltip title="环比变化">
        {content}
      </Tooltip>
    );
  }

  return content;
};

export default WowChangeIndicator;
```

### 4. 趋势图组件 (TrendChart.tsx)

```tsx
import React, { useRef, useEffect } from 'react';
import * as echarts from 'echarts';
import type { DashboardTrendDataResponseAllOfDataMetricType } from '@/types/api.schemas';

interface TrendChartProps {
  dates: string[];
  values: number[];
  metricType?: DashboardTrendDataResponseAllOfDataMetricType;
  height?: number;
}

const TrendChart: React.FC<TrendChartProps> = ({
  dates,
  values,
  metricType = 'cost_per_lead',
  height = 400
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  const getMetricLabel = (type: string): string => {
    const labels: Record<string, string> = {
      cost_per_lead: '线索成本',
      cost_per_customer: '开户成本',
      cost_per_valid_account: '有效户成本'
    };
    return labels[type] || type;
  };

  useEffect(() => {
    if (!chartRef.current) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const data = params[0];
          return `${data.axisValue}<br/>${getMetricLabel(metricType)}: ¥${data.value?.toLocaleString()}`;
        }
      },
      xAxis: {
        type: 'category',
        data: dates,
        axisLabel: {
          rotate: 45
        }
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: '¥{value}'
        }
      },
      series: [
        {
          name: getMetricLabel(metricType),
          type: 'line',
          data: values,
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: {
            width: 2
          },
          areaStyle: {
            opacity: 0.1
          }
        }
      ],
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        containLabel: true
      }
    };

    chartInstance.current.setOption(option);

    const handleResize = () => {
      chartInstance.current?.resize();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [dates, values, metricType]);

  useEffect(() => {
    return () => {
      chartInstance.current?.dispose();
    };
  }, []);

  return (
    <div
      ref={chartRef}
      style={{ width: '100%', height }}
    />
  );
};

export default TrendChart;
```

### 5. 筛选器组件 (FilterBar.tsx)

```tsx
import React from 'react';
import { Card, Form, Row, Col, DatePicker, Select, Button, Space } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

interface DashboardFilters {
  start_date?: string;
  end_date?: string;
  platforms?: string[];
  agencies?: string[];
  business_models?: string[];
}

interface FilterBarProps {
  filters: DashboardFilters;
  onChange: (filters: DashboardFilters) => void;
  platforms?: string[];
  agencies?: string[];
}

const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  onChange,
  platforms = ['腾讯', '抖音', '小红书'],
  agencies = []
}) => {
  const [form] = Form.useForm();

  const handleValuesChange = (changedValues: any, allValues: any) => {
    const newFilters: DashboardFilters = {};

    if (allValues.dateRange?.[0] && allValues.dateRange?.[1]) {
      newFilters.start_date = allValues.dateRange[0].format('YYYY-MM-DD');
      newFilters.end_date = allValues.dateRange[1].format('YYYY-MM-DD');
    }

    if (allValues.platforms?.length) {
      newFilters.platforms = allValues.platforms;
    }

    if (allValues.agencies?.length) {
      newFilters.agencies = allValues.agencies;
    }

    if (allValues.business_models?.length) {
      newFilters.business_models = allValues.business_models;
    }

    onChange(newFilters);
  };

  const handleReset = () => {
    form.resetFields();
    onChange({});
  };

  return (
    <Card className="filter-card">
      <Form
        form={form}
        layout="inline"
        onValuesChange={handleValuesChange}
        initialValues={{
          dateRange: filters.start_date && filters.end_date
            ? [dayjs(filters.start_date), dayjs(filters.end_date)]
            : undefined
        }}
      >
        <Row gutter={[16, 16]} style={{ width: '100%' }}>
          <Col>
            <Form.Item name="dateRange" label="日期范围">
              <DatePicker.RangePicker />
            </Form.Item>
          </Col>
          <Col>
            <Form.Item name="platforms" label="平台">
              <Select
                mode="multiple"
                placeholder="请选择平台"
                style={{ minWidth: 150 }}
                options={platforms.map(p => ({ label: p, value: p }))}
                allowClear
              />
            </Form.Item>
          </Col>
          <Col>
            <Form.Item name="agencies" label="代理商">
              <Select
                mode="multiple"
                placeholder="请选择代理商"
                style={{ minWidth: 150 }}
                options={agencies.map(a => ({ label: a, value: a }))}
                allowClear
              />
            </Form.Item>
          </Col>
          <Col>
            <Form.Item name="business_models" label="业务模式">
              <Select
                mode="multiple"
                placeholder="请选择业务模式"
                style={{ minWidth: 150 }}
                options={[
                  { label: '直播', value: '直播' },
                  { label: '信息流', value: '信息流' },
                  { label: '搜索', value: '搜索' }
                ]}
                allowClear
              />
            </Form.Item>
          </Col>
          <Col>
            <Space>
              <Button type="primary" icon={<SearchOutlined />}>
                查询
              </Button>
              <Button icon={<ReloadOutlined />} onClick={handleReset}>
                重置
              </Button>
            </Space>
          </Col>
        </Row>
      </Form>
    </Card>
  );
};

export default FilterBar;
```

---

## 自定义 Hooks

### 1. useCoreMetrics Hook

```typescript
import { useState, useEffect, useCallback } from 'react';
import { postDashboardCoreMetrics } from '@/types/api';
import type { CoreMetrics, WowChange } from '@/types/api.schemas';

interface DashboardFilters {
  start_date?: string;
  end_date?: string;
  platforms?: string[];
  agencies?: string[];
  business_models?: string[];
}

interface UseCoreMetricsResult {
  coreMetrics: CoreMetrics | null;
  wowChanges: WowChange | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export const useCoreMetrics = (filters: DashboardFilters): UseCoreMetricsResult => {
  const [coreMetrics, setCoreMetrics] = useState<CoreMetrics | null>(null);
  const [wowChanges, setWowChanges] = useState<WowChange | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await postDashboardCoreMetrics({
        start_date: filters.start_date,
        end_date: filters.end_date,
        platforms: filters.platforms,
        agencies: filters.agencies,
        business_models: filters.business_models
      });

      if (response.success && response.data) {
        setCoreMetrics(response.data.core_metrics || null);
        setWowChanges(response.data.wow_changes || null);
      } else {
        throw new Error(response.message || '获取核心指标失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('获取核心指标失败'));
    } finally {
      setLoading(false);
    }
  }, [filters.start_date, filters.end_date, filters.platforms, filters.agencies, filters.business_models]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    coreMetrics,
    wowChanges,
    loading,
    error,
    refetch: fetchData
  };
};
```

### 2. useTrendData Hook

```typescript
import { useState, useEffect, useCallback } from 'react';
import { postDashboardTrendData } from '@/types/api';
import type { DashboardTrendDataResponseAllOfData } from '@/types/api.schemas';

interface DashboardFilters {
  start_date?: string;
  end_date?: string;
  platforms?: string[];
  agencies?: string[];
  business_models?: string[];
}

interface UseTrendDataResult {
  trendData: DashboardTrendDataResponseAllOfData | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export const useTrendData = (
  filters: DashboardFilters,
  metricType: 'cost_per_lead' | 'cost_per_customer' | 'cost_per_valid_account' = 'cost_per_lead'
): UseTrendDataResult => {
  const [trendData, setTrendData] = useState<DashboardTrendDataResponseAllOfData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!filters.start_date || !filters.end_date) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await postDashboardTrendData({
        start_date: filters.start_date,
        end_date: filters.end_date,
        platforms: filters.platforms,
        agencies: filters.agencies,
        business_models: filters.business_models,
        metric_type: metricType
      });

      if (response.success && response.data) {
        setTrendData(response.data);
      } else {
        throw new Error(response.message || '获取趋势数据失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('获取趋势数据失败'));
    } finally {
      setLoading(false);
    }
  }, [filters, metricType]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    trendData,
    loading,
    error,
    refetch: fetchData
  };
};
```

### 3. useDashboardFilters Hook

```typescript
import { useState, useCallback } from 'react';

interface DashboardFilters {
  start_date?: string;
  end_date?: string;
  platforms?: string[];
  agencies?: string[];
  business_models?: string[];
}

export const useDashboardFilters = (initialFilters?: DashboardFilters) => {
  const [filters, setFilters] = useState<DashboardFilters>(initialFilters || {});

  const updateFilters = useCallback((newFilters: Partial<DashboardFilters>) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters
    }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({});
  }, []);

  return {
    filters,
    updateFilters,
    resetFilters
  };
};
```

---

## 迁移检查清单

### 功能完整性

- [ ] 核心指标卡片展示
- [ ] 环比变化显示
- [ ] 趋势图渲染
- [ ] 筛选器功能
- [ ] 数据加载状态
- [ ] 错误处理
- [ ] 响应式布局

### 类型安全

- [ ] 使用自动生成的 API 类型
- [ ] 所有 props 定义类型
- [ ] 所有 state 定义类型
- [ ] 无 any 类型

### 样式规范

- [ ] 使用 Ant Design 组件
- [ ] 遵循项目设计规范
- [ ] 响应式设计
- [ ] 主题支持

### 性能优化

- [ ] 数据请求使用 useCallback
- [ ] 图表实例正确销毁
- [ ] 避免不必要的重渲染

---

## 注意事项

### WowChange 格式差异

原 JavaScript 代码中的 WowChange 格式与后端返回的格式需要确认一致性：

**后端返回格式**:
```json
{
  "value": 12.5,
  "trend": "up",
  "color": "green"
}
```

**前端处理逻辑**:
- `trend`: 表示变化方向 (`up`/`down`/`flat`)
- `color`: 表示显示颜色 (`green` 表示正向，`red` 表示负向)
- 对于成本类指标，`color` 与 `trend` 相反（成本上升是负向，颜色为 `red`）

### API 调用方式

所有 Dashboard 相关接口现在使用 `POST` 方法，请求参数通过 request body 传递，而非 query parameters。

### 数据格式化

- 金额类数据: 使用 `toLocaleString('zh-CN', { minimumFractionDigits: 2 })`
- 数量类数据: 使用 `toLocaleString('zh-CN')`
- 百分比: 使用 `toFixed(2)` 后加 `%`

---

## 相关文档

- [API 类型自动生成](./02-api-type-generation.md)
- [项目结构规范](./01-project-structure.md)
- [前端设计规范](/.claude/rules/frontend-design/)
- [API 接口规则](/.claude/rules/api-rules.md)