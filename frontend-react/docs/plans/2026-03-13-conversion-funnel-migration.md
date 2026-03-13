# 转化漏斗页面迁移实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将原生JS版本的转化漏斗页面完整迁移至React前端，确保功能对等、UI一致、API参数完整

**Architecture:** React组件化架构，使用FilterBar筛选器组件、ChartCard图表卡片组件、FunnelChart漏斗图组件，通过自定义Hooks管理状态和API调用

**Tech Stack:** React 19, TypeScript 5, Ant Design, ECharts/@ant-design/charts, Zustand, SCSS Modules

---

## ⚠️ 迁移前必读：常见问题检查清单

### 1. API参数完整性检查

| 参数名 | 是否必需 | 默认值 | 说明 |
|--------|---------|--------|------|
| `start_date` | ✅ 是 | - | 开始日期 |
| `end_date` | ✅ 是 | - | 结束日期 |
| `platforms` | ❌ 否 | [] | 平台筛选（数组） |
| `agencies` | ❌ 否 | [] | 代理商筛选（数组） |
| `business_models` | ❌ 否 | [] | 业务模式筛选（数组） |

### 2. 筛选器选项验证

- [ ] 平台选项从API元数据获取（不硬编码）
- [ ] 代理商选项从API元数据获取
- [ ] 业务模式选项从API元数据获取
- [ ] 日期范围筛选器默认显示"全部"

### 3. 图表组件完整性验证

- [ ] 漏斗图有标题
- [ ] 有维度切换按钮（平台/代理商/业务模式）
- [ ] 有数据表格展示详细数据
- [ ] 有加载状态和空状态

### 4. 布局一致性验证

- [ ] 筛选器使用FilterBar组件
- [ ] 图表使用ChartCard组件
- [ ] 卡片间距使用统一标准（20px）

---

## Task 1: 创建类型定义

**Files:**
- Modify: `src/types/api.schemas.ts`

**Step 1: 添加转化漏斗API请求类型**

```typescript
// 在 src/types/api.schemas.ts 中添加

/**
 * 转化漏斗API请求参数
 */
export interface PostConversionFunnelBody {
  start_date: string;
  end_date: string;
  platforms?: string[];
  agencies?: string[];
  business_models?: string[];
}

/**
 * 漏斗阶段数据
 */
export interface FunnelStage {
  stage: string;
  count: number;
  rate: number;
  label: string;
}

/**
 * 转化漏斗API响应
 */
export interface ConversionFunnelResponse {
  funnel: FunnelStage[];
  comparison?: {
    previous_period: FunnelStage[];
  };
  by_dimension?: {
    [key: string]: FunnelStage[];
  };
}
```

**Step 2: 验证类型定义**

运行: `npm run type-check`
预期: 无类型错误

---

## Task 2: 创建API调用Hook

**Files:**
- Create: `src/pages/ConversionFunnel/hooks/useConversionFunnel.ts`

**Step 1: 编写useConversionFunnel Hook**

```typescript
import { useState, useCallback } from 'react';
import { apiClient } from '@/utils/api';
import type { PostConversionFunnelBody, ConversionFunnelResponse } from '@/types/api.schemas';

interface UseConversionFunnelReturn {
  funnelData: ConversionFunnelResponse | null;
  loading: boolean;
  error: string | null;
  fetchFunnelData: (params: PostConversionFunnelBody) => Promise<void>;
}

export function useConversionFunnel(): UseConversionFunnelReturn {
  const [funnelData, setFunnelData] = useState<ConversionFunnelResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFunnelData = useCallback(async (params: PostConversionFunnelBody) => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.post<ConversionFunnelResponse>(
        '/api/v1/conversion-funnel',
        params
      );
      setFunnelData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取转化漏斗数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  return { funnelData, loading, error, fetchFunnelData };
}
```

**Step 2: 验证Hook功能**

运行: `npm run type-check`
预期: 无类型错误

---

## Task 3: 创建筛选器Hook

**Files:**
- Create: `src/pages/ConversionFunnel/hooks/useFunnelFilters.ts`

**Step 1: 编写useFunnelFilters Hook**

```typescript
import { useState, useCallback } from 'react';
import type { PostConversionFunnelBody } from '@/types/api.schemas';

interface FunnelFilters {
  start_date: string;
  end_date: string;
  platforms: string[];
  agencies: string[];
  business_models: string[];
}

interface UseFunnelFiltersReturn {
  filters: FunnelFilters;
  updateFilters: (newFilters: Partial<FunnelFilters>) => void;
  resetFilters: () => void;
  getApiParams: () => PostConversionFunnelBody;
}

const DEFAULT_FILTERS: FunnelFilters = {
  start_date: '',
  end_date: '',
  platforms: [],
  agencies: [],
  business_models: [],
};

export function useFunnelFilters(): UseFunnelFiltersReturn {
  const [filters, setFilters] = useState<FunnelFilters>(DEFAULT_FILTERS);

  const updateFilters = useCallback((newFilters: Partial<FunnelFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const getApiParams = useCallback((): PostConversionFunnelBody => {
    const params: PostConversionFunnelBody = {
      start_date: filters.start_date,
      end_date: filters.end_date,
    };

    // 只有非空数组才添加可选参数
    if (filters.platforms.length > 0) {
      params.platforms = filters.platforms;
    }
    if (filters.agencies.length > 0) {
      params.agencies = filters.agencies;
    }
    if (filters.business_models.length > 0) {
      params.business_models = filters.business_models;
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

## Task 4: 创建漏斗图组件

**Files:**
- Create: `src/pages/ConversionFunnel/components/FunnelChart.tsx`
- Create: `src/pages/ConversionFunnel/components/FunnelChart.module.scss`

**Step 1: 编写FunnelChart组件**

```typescript
/**
 * 转化漏斗图组件
 */
import React from 'react';
import { Column } from '@ant-design/charts';
import { Spin, Empty } from 'antd';
import type { FunnelStage } from '@/types/api.schemas';
import styles from './FunnelChart.module.scss';

interface FunnelChartProps {
  data: FunnelStage[];
  loading?: boolean;
  height?: number;
}

const FunnelChart: React.FC<FunnelChartProps> = ({
  data,
  loading = false,
  height = 400,
}) => {
  const config = {
    data: data.map((item, index) => ({
      stage: item.label || item.stage,
      count: item.count,
      rate: item.rate,
      index,
    })),
    xField: 'count',
    yField: 'stage',
    seriesField: 'stage',
    color: ['#1890ff', '#40a9ff', '#69c0ff', '#91d5ff', '#bae7ff'],
    legend: false,
    tooltip: {
      formatter: (datum: any) => ({
        name: datum.stage,
        value: `${datum.count?.toLocaleString()} (${datum.rate?.toFixed(2)}%)`,
      }),
    },
    label: {
      position: 'right' as const,
      formatter: (datum: any) => `${datum.count?.toLocaleString()}`,
    },
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer} style={{ height }}>
        <Spin />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className={styles.emptyContainer} style={{ height }}>
        <Empty description="暂无数据" />
      </div>
    );
  }

  return (
    <div style={{ height }}>
      <Column {...config} />
    </div>
  );
};

export default FunnelChart;
```

**Step 2: 编写样式文件**

```scss
// FunnelChart.module.scss
.loadingContainer,
.emptyContainer {
  display: flex;
  align-items: center;
  justify-content: center;
}
```

**Step 3: 验证组件**

运行: `npm run type-check`
预期: 无类型错误

---

## Task 5: 创建维度数据表格组件

**Files:**
- Create: `src/pages/ConversionFunnel/components/DimensionTable.tsx`

**Step 1: 编写DimensionTable组件**

```typescript
/**
 * 维度数据表格组件
 * 展示各维度的转化漏斗数据
 */
import React from 'react';
import { Table } from 'antd';
import type { FunnelStage } from '@/types/api.schemas';

interface DimensionTableProps {
  data: { [key: string]: FunnelStage[] };
  loading?: boolean;
}

const DimensionTable: React.FC<DimensionTableProps> = ({ data, loading }) => {
  // 将维度数据转换为表格数据
  const tableData = React.useMemo(() => {
    if (!data) return [];

    return Object.entries(data).map(([dimension, stages], index) => {
      const rowData: Record<string, any> = {
        key: index,
        dimension,
      };

      stages.forEach((stage) => {
        rowData[stage.stage] = stage.count;
        rowData[`${stage.stage}_rate`] = stage.rate;
      });

      return rowData;
    });
  }, [data]);

  // 动态生成列
  const columns = React.useMemo(() => {
    if (!data || Object.keys(data).length === 0) {
      return [
        { title: '维度', dataIndex: 'dimension', key: 'dimension' },
      ];
    }

    const firstEntry = Object.values(data)[0];
    const stageColumns = firstEntry.map((stage) => ({
      title: stage.label || stage.stage,
      dataIndex: stage.stage,
      key: stage.stage,
      render: (value: number, record: any) => (
        <div>
          <div>{value?.toLocaleString()}</div>
          <div style={{ fontSize: 12, color: '#999' }}>
            {record[`${stage.stage}_rate`]?.toFixed(2)}%
          </div>
        </div>
      ),
    }));

    return [
      { title: '维度', dataIndex: 'dimension', key: 'dimension', fixed: 'left' as const },
      ...stageColumns,
    ];
  }, [data]);

  return (
    <Table
      columns={columns}
      dataSource={tableData}
      loading={loading}
      pagination={false}
      scroll={{ x: 'max-content' }}
      size="small"
    />
  );
};

export default DimensionTable;
```

**Step 2: 验证组件**

运行: `npm run type-check`
预期: 无类型错误

---

## Task 6: 创建主页面组件

**Files:**
- Modify: `src/pages/ConversionFunnel/index.tsx`
- Create: `src/pages/ConversionFunnel/index.module.scss`
- Create: `src/pages/ConversionFunnel/hooks/index.ts`

**Step 1: 导出Hooks**

```typescript
// src/pages/ConversionFunnel/hooks/index.ts
export { useConversionFunnel } from './useConversionFunnel';
export { useFunnelFilters } from './useFunnelFilters';
```

**Step 2: 编写主页面组件**

```typescript
/**
 * 转化漏斗页面
 * 展示从曝光到开户的转化漏斗分析
 */
import React, { useEffect, useState, useCallback } from 'react';
import { Card, Row, Col, Radio, Segmented, Spin, Typography } from 'antd';
import { FilterBar } from '@/components';
import FunnelChart from './components/FunnelChart';
import DimensionTable from './components/DimensionTable';
import { useConversionFunnel, useFunnelFilters } from './hooks';
import { useMetadata } from '@/hooks/useMetadata';
import styles from './index.module.scss';

const { Title } = Typography;

type DimensionType = 'platform' | 'agency' | 'business_model';

const ConversionFunnelPage: React.FC = () => {
  const [dimension, setDimension] = useState<DimensionType>('platform');

  const { metadata, loading: metadataLoading } = useMetadata();
  const { filters, updateFilters, resetFilters, getApiParams } = useFunnelFilters();
  const { funnelData, loading, error, fetchFunnelData } = useConversionFunnel();

  // 初始加载
  useEffect(() => {
    // 设置默认日期范围（最近30天）
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    updateFilters({
      start_date: thirtyDaysAgo.toISOString().split('T')[0],
      end_date: today.toISOString().split('T')[0],
    });
  }, []);

  // 加载数据
  const loadData = useCallback(() => {
    const params = getApiParams();
    if (params.start_date && params.end_date) {
      fetchFunnelData(params);
    }
  }, [getApiParams, fetchFunnelData]);

  // 筛选器变化时重新加载
  useEffect(() => {
    loadData();
  }, [filters]);

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
  }, [updateFilters]);

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
  }, [resetFilters, updateFilters]);

  return (
    <div className={styles.conversionFunnelPage}>
      <Spin spinning={loading || metadataLoading}>
        {/* 筛选器 */}
        <FilterBar
          showPlatform
          showAgency
          showBusinessModel
          onSearch={handleSearch}
          onReset={handleReset}
        />

        {/* 漏斗图卡片 */}
        <Card className={styles.funnelCard}>
          <div className={styles.cardHeader}>
            <Title level={4}>转化漏斗</Title>
            <div className={styles.dimensionSwitch}>
              <span>维度：</span>
              <Segmented
                value={dimension}
                onChange={(value) => setDimension(value as DimensionType)}
                options={[
                  { label: '平台', value: 'platform' },
                  { label: '代理商', value: 'agency' },
                  { label: '业务模式', value: 'business_model' },
                ]}
              />
            </div>
          </div>
          <div className={styles.chartContainer}>
            <FunnelChart
              data={funnelData?.funnel || []}
              loading={loading}
              height={400}
            />
          </div>
        </Card>

        {/* 维度数据表格 */}
        {funnelData?.by_dimension && (
          <Card className={styles.tableCard}>
            <Title level={4}>各维度转化数据</Title>
            <DimensionTable
              data={funnelData.by_dimension}
              loading={loading}
            />
          </Card>
        )}
      </Spin>
    </div>
  );
};

export default ConversionFunnelPage;
```

**Step 3: 编写样式文件**

```scss
// index.module.scss
.conversionFunnelPage {
  padding: 20px;
}

.funnelCard,
.tableCard {
  margin-top: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.cardHeader {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;

  h4 {
    margin: 0;
  }
}

.dimensionSwitch {
  display: flex;
  align-items: center;
  gap: 8px;
}

.chartContainer {
  min-height: 400px;
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
// 在 src/router/index.tsx 中添加路由
import ConversionFunnelPage from '@/pages/ConversionFunnel';

// 在路由配置中添加
{
  path: '/conversion-funnel',
  element: <ConversionFunnelPage />,
  meta: {
    title: '转化漏斗',
    icon: 'FunnelPlotOutlined',
  },
}
```

**Step 2: 验证路由**

运行: `npm run dev`
访问: `http://localhost:5173/conversion-funnel`
预期: 页面正常渲染

---

## Task 8: 功能验证

**Step 1: 验证API参数完整性**

打开浏览器 Network 面板，执行以下操作：
1. 切换筛选条件
2. 检查每个 API 请求的参数是否完整

**验证清单:**
- [ ] `start_date` 参数存在
- [ ] `end_date` 参数存在
- [ ] `platforms` 参数为数组
- [ ] `agencies` 参数为数组
- [ ] `business_models` 参数为数组

**Step 2: 验证筛选器选项**

- [ ] 平台选项来自 API 元数据
- [ ] 代理商选项来自 API 元数据
- [ ] 业务模式选项来自 API 元数据

**Step 3: 验证图表功能**

- [ ] 漏斗图正常显示
- [ ] 维度切换功能正常
- [ ] Tooltip 显示正确

**Step 4: 验证数据表格**

- [ ] 表格数据正确显示
- [ ] 各维度数据切换正常

---

## Task 9: 提交代码

**Step 1: 检查代码质量**

```bash
npm run lint
npm run type-check
npm run build
```

**Step 2: 提交代码**

```bash
git add src/pages/ConversionFunnel src/types/api.schemas.ts src/router/index.tsx
git commit -m "feat: 迁移转化漏斗页面至React前端

- 添加转化漏斗API类型定义
- 创建useConversionFunnel和useFunnelFilters自定义Hooks
- 创建FunnelChart和DimensionTable组件
- 实现完整的筛选功能和维度切换
- 支持API参数完整性检查

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## 验收标准

- [ ] 所有API参数完整传递
- [ ] 筛选器选项从API元数据获取
- [ ] 图表有标题和维度切换功能
- [ ] 数据表格正确显示
- [ ] 响应式布局正常
- [ ] 无TypeScript编译错误
- [ ] 无ESLint警告

---

**最后更新**: 2026-03-13
**维护者**: Claude AI