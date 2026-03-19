# 厂商分析报表差异化迁移实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 采用差异化迁移策略，保留成熟稳定的旧版图表和表格逻辑，仅用Ant Design筛选器替换旧版筛选器，实现厂商分析报表的快速迁移。

**Architecture:** 采用"Ant Design筛选器 + 旧版图表/表格逻辑"的混合架构。通过`useLegacyReport` Hook封装旧版`AgencyAnalysisReport`类实例，管理其生命周期和数据更新。筛选器数据通过适配器函数转换为旧版格式后传递给旧版类。

**Tech Stack:** React 19, TypeScript, Ant Design 6.3, ECharts 5.x, Zustand 5.0

---

## 任务概览

| 任务 | 文件 | 预估时间 |
|------|------|----------|
| Task 1 | 创建useLegacyReport Hook | 30min |
| Task 2 | 创建筛选器适配器函数 | 20min |
| Task 3 | 重构AgencyAnalysis页面组件 | 40min |
| Task 4 | 添加旧版JS加载器 | 20min |
| Task 5 | 更新样式和布局 | 15min |
| Task 6 | E2E测试验证 | 30min |

---

## Task 1: 创建useLegacyReport Hook

**Files:**
- Create: `开发代码/frontend-react/src/hooks/useLegacyReport.ts`
- Test: `开发代码/frontend-react/src/hooks/__tests__/useLegacyReport.test.ts`

**Step 1: 创建测试文件（TDD）**

```typescript
// 开发代码/frontend-react/src/hooks/__tests__/useLegacyReport.test.ts
import { renderHook, act } from '@testing-library/react-hooks';
import { useLegacyReport } from '../useLegacyReport';

// Mock window.AgencyAnalysisReport
const mockReportInstance = {
  loadData: jest.fn().mockResolvedValue(undefined),
  updateData: jest.fn(),
  destroy: jest.fn(),
  exportTableToExcel: jest.fn(),
};

beforeAll(() => {
  (window as any).AgencyAnalysisReport = jest.fn(() => mockReportInstance);
});

afterAll(() => {
  delete (window as any).AgencyAnalysisReport;
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useLegacyReport', () => {
  it('should initialize legacy report on mount', () => {
    renderHook(() => useLegacyReport('AgencyAnalysisReport'));

    expect((window as any).AgencyAnalysisReport).toHaveBeenCalled();
  });

  it('should destroy report on unmount', () => {
    const { unmount } = renderHook(() => useLegacyReport('AgencyAnalysisReport'));

    unmount();

    expect(mockReportInstance.destroy).toHaveBeenCalled();
  });

  it('should return null when class not found', () => {
    delete (window as any).AgencyAnalysisReport;

    const { result } = renderHook(() => useLegacyReport('NonExistentClass'));

    expect(result.current.report).toBeNull();
  });
});
```

**Step 2: 运行测试确认失败**

```bash
cd 开发代码/frontend-react
npm test -- src/hooks/__tests__/useLegacyReport.test.ts
```

Expected: FAIL - useLegacyReport not implemented

**Step 3: 实现useLegacyReport Hook**

```typescript
// 开发代码/frontend-react/src/hooks/useLegacyReport.ts
/**
 * 封装旧版报表类的 React Hook
 * 管理旧版类的生命周期、数据加载和清理
 */
import { useState, useEffect, useCallback, useRef } from 'react';

interface LegacyReportInstance {
  loadData: (filters?: any) => Promise<void>;
  updateData: () => void;
  destroy: () => void;
  exportTableToExcel?: () => void;
  [key: string]: any;
}

interface UseLegacyReportReturn {
  report: LegacyReportInstance | null;
  isLoading: boolean;
  error: Error | null;
  refresh: (filters?: any) => Promise<void>;
  exportData: () => void;
}

/**
 * 封装旧版报表类的 Hook
 * @param className 旧版类名（挂载在 window 对象上）
 */
export function useLegacyReport(className: string): UseLegacyReportReturn {
  const [report, setReport] = useState<LegacyReportInstance | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const isInitialized = useRef(false);

  // 初始化旧版报表实例
  useEffect(() => {
    // 避免重复初始化
    if (isInitialized.current) return;
    isInitialized.current = true;

    const LegacyClass = (window as any)[className];

    if (!LegacyClass) {
      console.warn(`[useLegacyReport] 未找到旧版类: ${className}`);
      setError(new Error(`Legacy class "${className}" not found`));
      return;
    }

    try {
      // 延迟初始化，确保 DOM 已渲染
      const timer = setTimeout(() => {
        const instance = new LegacyClass();
        setReport(instance);
        console.log(`[useLegacyReport] 成功初始化: ${className}`);
      }, 100);

      // 清理函数
      return () => {
        clearTimeout(timer);
        setReport((currentReport) => {
          if (currentReport && typeof currentReport.destroy === 'function') {
            console.log(`[useLegacyReport] 销毁实例: ${className}`);
            currentReport.destroy();
          }
          return null;
        });
        isInitialized.current = false;
      };
    } catch (err) {
      console.error(`[useLegacyReport] 初始化失败:`, err);
      setError(err instanceof Error ? err : new Error(String(err)));
    }
  }, [className]);

  // 刷新数据
  const refresh = useCallback(
    async (filters?: any) => {
      if (!report) {
        console.warn('[useLegacyReport] 报表实例未初始化，无法刷新');
        return;
      }

      setIsLoading(true);
      try {
        if (typeof report.loadData === 'function') {
          await report.loadData(filters);
        }
        if (typeof report.updateData === 'function') {
          report.updateData();
        }
      } catch (err) {
        console.error('[useLegacyReport] 刷新数据失败:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setIsLoading(false);
      }
    },
    [report]
  );

  // 导出数据
  const exportData = useCallback(() => {
    if (report && typeof report.exportTableToExcel === 'function') {
      report.exportTableToExcel();
    }
  }, [report]);

  return {
    report,
    isLoading,
    error,
    refresh,
    exportData,
  };
}
```

**Step 4: 运行测试确认通过**

```bash
cd 开发代码/frontend-react
npm test -- src/hooks/__tests__/useLegacyReport.test.ts
```

Expected: PASS

**Step 5: 提交**

```bash
cd 开发代码
git add frontend-react/src/hooks/useLegacyReport.ts frontend-react/src/hooks/__tests__/useLegacyReport.test.ts
git commit -m "feat(hooks): add useLegacyReport hook for legacy class integration"
```

---

## Task 2: 创建筛选器适配器函数

**Files:**
- Create: `开发代码/frontend-react/src/utils/filterAdapter.ts`

**Step 1: 创建适配器函数**

```typescript
// 开发代码/frontend-react/src/utils/filterAdapter.ts
/**
 * 筛选器数据格式适配器
 * 将 React/Ant Design 筛选器格式转换为旧版 JS 格式
 */

/**
 * React 筛选器状态（来自 Zustand Store）
 */
export interface ReactFilterState {
  dateRange: {
    startDate: string;
    endDate: string;
  };
  selectedPlatforms: string[];
  selectedAgencies: string[];
  selectedBusinessModels: string[];
  selectedEmployees: string[];
}

/**
 * 旧版 JS 筛选器格式
 */
export interface LegacyFilterFormat {
  platforms?: string[];
  business_models?: string[];
  agencies?: string[];
  date_range?: [string, string];
}

/**
 * 将 React 筛选器格式转换为旧版格式
 * @param filters React 筛选器状态
 * @returns 旧版筛选器格式
 */
export function convertToLegacyFormat(filters: ReactFilterState): LegacyFilterFormat {
  const legacyFilters: LegacyFilterFormat = {};

  // 平台（数组保持不变）
  if (filters.selectedPlatforms.length > 0) {
    legacyFilters.platforms = filters.selectedPlatforms;
  }

  // 业务模式
  if (filters.selectedBusinessModels.length > 0) {
    legacyFilters.business_models = filters.selectedBusinessModels;
  }

  // 代理商
  if (filters.selectedAgencies.length > 0) {
    legacyFilters.agencies = filters.selectedAgencies;
  }

  // 日期范围
  if (filters.dateRange.startDate && filters.dateRange.endDate) {
    legacyFilters.date_range = [
      filters.dateRange.startDate,
      filters.dateRange.endDate,
    ];
  }

  return legacyFilters;
}

/**
 * 将旧版筛选器格式转换为 API 查询参数
 * @param filters 旧版筛选器格式
 * @returns API 查询参数对象
 */
export function convertToApiParams(filters: LegacyFilterFormat): Record<string, string> {
  const params: Record<string, string> = {};

  if (filters.platforms?.length) {
    params.platforms = filters.platforms.join(',');
  }
  if (filters.business_models?.length) {
    params.business_models = filters.business_models.join(',');
  }
  if (filters.agencies?.length) {
    params.agencies = filters.agencies.join(',');
  }
  if (filters.date_range) {
    params.start_date = filters.date_range[0];
    params.end_date = filters.date_range[1];
  }

  return params;
}
```

**Step 2: 创建单元测试**

```typescript
// 开发代码/frontend-react/src/utils/__tests__/filterAdapter.test.ts
import {
  convertToLegacyFormat,
  convertToApiParams,
  ReactFilterState,
} from '../filterAdapter';

describe('filterAdapter', () => {
  describe('convertToLegacyFormat', () => {
    it('should convert empty filters', () => {
      const filters: ReactFilterState = {
        dateRange: { startDate: '', endDate: '' },
        selectedPlatforms: [],
        selectedAgencies: [],
        selectedBusinessModels: [],
        selectedEmployees: [],
      };

      const result = convertToLegacyFormat(filters);

      expect(result).toEqual({});
    });

    it('should convert all filters', () => {
      const filters: ReactFilterState = {
        dateRange: { startDate: '2025-01-01', endDate: '2025-01-31' },
        selectedPlatforms: ['腾讯', '抖音'],
        selectedAgencies: ['量子'],
        selectedBusinessModels: ['直播'],
        selectedEmployees: [],
      };

      const result = convertToLegacyFormat(filters);

      expect(result).toEqual({
        platforms: ['腾讯', '抖音'],
        agencies: ['量子'],
        business_models: ['直播'],
        date_range: ['2025-01-01', '2025-01-31'],
      });
    });
  });

  describe('convertToApiParams', () => {
    it('should convert to API params', () => {
      const legacyFilters = {
        platforms: ['腾讯'],
        date_range: ['2025-01-01', '2025-01-31'] as [string, string],
      };

      const result = convertToApiParams(legacyFilters);

      expect(result).toEqual({
        platforms: '腾讯',
        start_date: '2025-01-01',
        end_date: '2025-01-31',
      });
    });
  });
});
```

**Step 3: 运行测试**

```bash
cd 开发代码/frontend-react
npm test -- src/utils/__tests__/filterAdapter.test.ts
```

Expected: PASS

**Step 4: 提交**

```bash
cd 开发代码
git add frontend-react/src/utils/filterAdapter.ts frontend-react/src/utils/__tests__/filterAdapter.test.ts
git commit -m "feat(utils): add filter adapter for legacy format conversion"
```

---

## Task 3: 重构AgencyAnalysis页面组件

**Files:**
- Modify: `开发代码/frontend-react/src/pages/AgencyAnalysis/index.tsx`
- Modify: `开发代码/frontend-react/src/pages/AgencyAnalysis/index.module.scss`

**Step 1: 重构页面组件，采用混合迁移架构**

```tsx
// 开发代码/frontend-react/src/pages/AgencyAnalysis/index.tsx
/**
 * 厂商分析页面 - 混合迁移版本
 *
 * 迁移策略：
 * 1. 筛选器：使用 Ant Design FilterBar 组件
 * 2. 日级趋势图：复用旧版 AgencyAnalysisReport.js 的图表渲染逻辑
 * 3. 平台×代理商聚合表格：复用旧版 AgencyAnalysisReport.js 的表格渲染逻辑
 *
 * 技术实现：
 * - 使用 useLegacyReport Hook 管理旧版类实例
 * - 通过 convertToLegacyFormat 适配器转换筛选器数据
 * - 旧版类直接操作 DOM 容器渲染图表和表格
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Segmented, Space, message, Button, Tooltip, Spin } from 'antd';
import { DollarOutlined, EyeOutlined, UserOutlined, TeamOutlined, AimOutlined, DownloadOutlined } from '@ant-design/icons';
import { FilterBar } from '@/components';
import { useFilterStore } from '@/stores';
import { useLegacyReport } from '@/hooks/useLegacyReport';
import { convertToLegacyFormat } from '@/utils/filterAdapter';
import { getAgencyAnalysis } from '@/types/api';
import type { AgencyAnalysisResponse } from '@/types/api.schemas';
import styles from './index.module.scss';

// 指标类型
type MetricType = 'cost' | 'impressions' | 'clicks' | 'lead_users' | 'opened_account_users' | 'valid_customer_users';

// 指标标签映射
const METRIC_LABELS: Record<MetricType, string> = {
  cost: '花费',
  impressions: '曝光',
  clicks: '点击',
  lead_users: '线索',
  opened_account_users: '开户',
  valid_customer_users: '有效户',
};

// 展平后的数据类型
interface FlattenedSummaryItem {
  platform: string;
  business_model: string;
  agency: string;
  is_subtotal?: boolean;
  is_total?: boolean;
  cost: number;
  impressions: number;
  clicks: number;
  lead_users: number;
  opened_account_users: number;
  valid_customer_users: number;
  opened_account_assets: number;
  existing_customer_assets: number;
  lead_cost: number;
  account_cost: number;
}

const AgencyAnalysisPage: React.FC = () => {
  const [summary, setSummary] = useState<FlattenedSummaryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [metric, setMetric] = useState<MetricType>('cost');

  const {
    dateRange,
    selectedPlatforms,
    selectedAgencies,
    selectedBusinessModels,
    resetAll,
  } = useFilterStore();

  // 使用 Hook 管理旧版报表实例
  const { report, isLoading: legacyLoading, refresh, exportData } = useLegacyReport('AgencyAnalysisReport');

  // 加载汇总数据（用于顶部统计卡片）
  const fetchSummaryData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = {};

      if (dateRange.startDate && dateRange.endDate) {
        params.start_date = dateRange.startDate;
        params.end_date = dateRange.endDate;
      }
      if (selectedPlatforms.length > 0) {
        params.platforms = selectedPlatforms.join(',');
      }
      if (selectedAgencies.length > 0) {
        params.agencies = selectedAgencies.join(',');
      }
      if (selectedBusinessModels.length > 0) {
        params.business_models = selectedBusinessModels.join(',');
      }

      const response: AgencyAnalysisResponse = await getAgencyAnalysis(params);

      if (response.success && response.data) {
        const flattenedSummary = (response.data.summary || []).map((item: any) => {
          const m = item.metrics || {};
          return {
            platform: item.platform || '',
            business_model: item.business_model || '',
            agency: item.agency || '',
            is_subtotal: item.is_subtotal,
            is_total: item.is_total,
            cost: m.cost || 0,
            impressions: m.impressions || 0,
            clicks: m.clicks || 0,
            lead_users: m.lead_users || 0,
            opened_account_users: m.opened_account_users || 0,
            valid_customer_users: m.valid_customer_users || 0,
            opened_account_assets: m.opened_account_assets || 0,
            existing_customer_assets: m.existing_customer_assets || 0,
            lead_cost: m.lead_cost || 0,
            account_cost: m.account_cost || 0,
          };
        }) as FlattenedSummaryItem[];

        setSummary(flattenedSummary);
      }
    } catch (error) {
      console.error('获取汇总数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, [dateRange, selectedPlatforms, selectedAgencies, selectedBusinessModels]);

  // 初始加载
  useEffect(() => {
    fetchSummaryData();
  }, []);

  // 处理筛选器查询
  const handleSearch = useCallback(() => {
    // 刷新汇总数据
    fetchSummaryData();

    // 刷新旧版图表和表格
    if (report) {
      const legacyFilters = convertToLegacyFormat({
        dateRange,
        selectedPlatforms,
        selectedAgencies,
        selectedBusinessModels,
        selectedEmployees: [],
      });
      refresh(legacyFilters);
    }
  }, [report, refresh, fetchSummaryData, dateRange, selectedPlatforms, selectedAgencies, selectedBusinessModels]);

  // 处理筛选器重置
  const handleReset = useCallback(() => {
    resetAll();
    fetchSummaryData();

    // 重置旧版图表和表格
    if (report) {
      refresh({});
    }
  }, [report, refresh, fetchSummaryData, resetAll]);

  // 计算汇总数据
  const totals = React.useMemo(() => {
    let totalCost = 0;
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalLeadUsers = 0;
    let totalOpenedAccountUsers = 0;
    let totalValidCustomerUsers = 0;

    summary.forEach(item => {
      if (item.is_subtotal || item.is_total) return;
      totalCost += item.cost || 0;
      totalImpressions += item.impressions || 0;
      totalClicks += item.clicks || 0;
      totalLeadUsers += item.lead_users || 0;
      totalOpenedAccountUsers += item.opened_account_users || 0;
      totalValidCustomerUsers += item.valid_customer_users || 0;
    });

    return {
      cost: totalCost,
      impressions: totalImpressions,
      clicks: totalClicks,
      leadUsers: totalLeadUsers,
      openedAccounts: totalOpenedAccountUsers,
      validCustomers: totalValidCustomerUsers,
    };
  }, [summary]);

  // 统计数据
  const stats = React.useMemo(() => {
    const agencies = new Set<string>();
    const platforms = new Set<string>();

    summary.forEach(item => {
      if (item.is_subtotal || item.is_total) return;
      if (item.platform) platforms.add(item.platform);
      if (item.agency && item.agency !== '未归因' && item.agency !== '[小计]' && item.agency !== '[合计]') {
        agencies.add(item.agency);
      }
    });

    return { agencyCount: agencies.size, platformCount: platforms.size };
  }, [summary]);

  return (
    <div className={styles.agencyAnalysisPage}>
      {/* Ant Design 筛选器 */}
      <FilterBar
        showPlatform
        showAgency
        showBusinessModel
        onSearch={handleSearch}
        onReset={handleReset}
      />

      {/* 汇总统计卡片 */}
      <Row gutter={16} className={styles.summaryRow}>
        <Col xs={12} sm={8} md={4}>
          <Card>
            <Statistic
              title="总花费"
              value={totals.cost}
              precision={2}
              prefix={<DollarOutlined />}
              formatter={(value) => `¥${Number(value).toLocaleString()}`}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card>
            <Statistic title="总曝光" value={totals.impressions} prefix={<EyeOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card>
            <Statistic title="总点击" value={totals.clicks} prefix={<AimOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card>
            <Statistic title="线索人数" value={totals.leadUsers} prefix={<UserOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card>
            <Statistic title="开户人数" value={totals.openedAccounts} prefix={<TeamOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card>
            <Statistic title="有效户人数" value={totals.validCustomers} prefix={<TeamOutlined />} />
          </Card>
        </Col>
      </Row>

      {/* 日级趋势图容器 - 由旧版 JS 渲染 */}
      <Card className={styles.chartCard}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>日级趋势图</h3>
          <Space size="middle">
            <span className={styles.controlLabel}>指标:</span>
            <Segmented
              value={metric}
              onChange={(value) => {
                setMetric(value as MetricType);
                // 同步到旧版报表
                if (report && report.setCurrentMetric) {
                  report.setCurrentMetric(value);
                }
              }}
              options={Object.entries(METRIC_LABELS).map(([key, label]) => ({
                label,
                value: key,
              }))}
            />
          </Space>
        </div>
        <Spin spinning={legacyLoading}>
          {/* 旧版 ECharts 图表容器 */}
          <div id="trendChart" className={styles.chartContainer} />
        </Spin>
      </Card>

      {/* 平台×代理商聚合数据表格容器 - 由旧版 JS 渲染 */}
      <Card className={styles.tableCard}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>平台×代理商聚合数据</h3>
          <Space>
            <span>代理商数量: <strong>{stats.agencyCount}</strong></span>
            <span style={{ margin: '0 8px', color: '#d9d9d9' }}>|</span>
            <span>平台数量: <strong>{stats.platformCount}</strong></span>
            <span style={{ margin: '0 8px', color: '#d9d9d9' }}>|</span>
            <Tooltip title="导出为Excel格式">
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                onClick={exportData}
                disabled={!report}
              >
                导出Excel
              </Button>
            </Tooltip>
          </Space>
        </div>
        <Spin spinning={loading || legacyLoading}>
          {/* 旧版表格容器 */}
          <div id="agencyTable" className={styles.tableContainer} />
        </Spin>
      </Card>
    </div>
  );
};

export default AgencyAnalysisPage;
```

**Step 2: 更新样式文件**

```scss
// 开发代码/frontend-react/src/pages/AgencyAnalysis/index.module.scss
/**
 * 厂商分析页面样式 - 混合迁移版本
 */
.agencyAnalysisPage {
  padding: 0;
}

.summaryRow {
  margin-bottom: 20px;

  :global {
    .ant-card {
      border-radius: 8px;
      height: 100%;
    }

    .ant-statistic {
      min-height: 60px;
    }

    .ant-statistic-content-value {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
    }
  }
}

.chartCard {
  margin-bottom: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.cardHeader {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.cardTitle {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.controlLabel {
  font-size: 14px;
  color: #666;
}

.chartContainer {
  width: 100%;
  height: 350px;
  min-height: 350px;
}

.tableCard {
  margin-top: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.tableContainer {
  width: 100%;
  min-height: 200px;

  // 为旧版表格样式提供覆盖
  :global {
    .data-table {
      width: 100%;
      border-collapse: collapse;

      th, td {
        padding: 12px 16px;
        text-align: left;
        border-bottom: 1px solid #f0f0f0;
      }

      th {
        background-color: #fafafa;
        font-weight: 600;
      }

      .subtotal-row {
        background-color: #fafafa;

        td {
          background-color: #fafafa !important;
          font-weight: 600;
        }
      }

      .total-row {
        background-color: #f0f0f0;

        td {
          background-color: #f0f0f0 !important;
          font-weight: 700;
        }
      }
    }
  }
}
```

**Step 3: 提交**

```bash
cd 开发代码
git add frontend-react/src/pages/AgencyAnalysis/index.tsx frontend-react/src/pages/AgencyAnalysis/index.module.scss
git commit -m "feat(agency-analysis): refactor to hybrid migration with legacy chart/table"
```

---

## Task 4: 添加旧版JS加载器

**Files:**
- Modify: `开发代码/frontend-react/index.html`
- Create: `开发代码/frontend-react/src/utils/legacyLoader.ts`

**Step 1: 创建旧版JS加载工具**

```typescript
// 开发代码/frontend-react/src/utils/legacyLoader.ts
/**
 * 旧版 JS 文件加载器
 * 用于在 React 应用中加载旧版前端 JS 文件
 */

const LEGACY_JS_FILES = [
  // 核心工具
  '/js/utils/EventManager.js',
  '/js/utils/MetadataManager.js',
  '/js/utils/chartHelper.js',
  // 报表类
  '/js/reports/AgencyAnalysisReport.js',
];

let loaded = false;
const loadingPromise: Promise<void>[] = [];

/**
 * 加载单个 JS 文件
 */
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // 检查是否已加载
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;

    script.onload = () => {
      console.log(`[legacyLoader] 加载成功: ${src}`);
      resolve();
    };

    script.onerror = () => {
      console.error(`[legacyLoader] 加载失败: ${src}`);
      reject(new Error(`Failed to load script: ${src}`));
    };

    document.head.appendChild(script);
  });
}

/**
 * 加载所有旧版 JS 文件
 */
export async function loadLegacyScripts(): Promise<void> {
  if (loaded) {
    console.log('[legacyLoader] 旧版 JS 已加载，跳过');
    return;
  }

  console.log('[legacyLoader] 开始加载旧版 JS 文件...');

  try {
    await Promise.all(LEGACY_JS_FILES.map(loadScript));
    loaded = true;
    console.log('[legacyLoader] 所有旧版 JS 文件加载完成');
  } catch (error) {
    console.error('[legacyLoader] 加载旧版 JS 文件失败:', error);
    throw error;
  }
}

/**
 * 检查旧版类是否可用
 */
export function isLegacyClassAvailable(className: string): boolean {
  return typeof (window as any)[className] === 'function';
}

/**
 * 等待旧版类可用
 */
export async function waitForLegacyClass(className: string, timeout = 5000): Promise<void> {
  const startTime = Date.now();

  while (!isLegacyClassAvailable(className)) {
    if (Date.now() - startTime > timeout) {
      throw new Error(`Timeout waiting for legacy class: ${className}`);
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}
```

**Step 2: 修改入口 HTML 添加旧版 JS 加载**

```html
<!-- 在开发代码/frontend-react/index.html 中添加 -->
<!-- 在 <head> 或 <body> 底部添加 -->
<script>
  // 在 React 应用启动前加载旧版 JS
  (function() {
    const legacyBase = window.location.hostname === 'localhost' ? '' : '/js';
    const scripts = [
      legacyBase + '/utils/EventManager.js',
      legacyBase + '/utils/MetadataManager.js',
      legacyBase + '/utils/chartHelper.js',
      legacyBase + '/reports/AgencyAnalysisReport.js',
    ];

    scripts.forEach(function(src) {
      var script = document.createElement('script');
      script.src = src;
      script.async = false; // 保持加载顺序
      document.head.appendChild(script);
    });
  })();
</script>
```

**Step 3: 提交**

```bash
cd 开发代码
git add frontend-react/src/utils/legacyLoader.ts frontend-react/index.html
git commit -m "feat(utils): add legacy JS loader for hybrid migration"
```

---

## Task 5: 创建hooks目录索引文件

**Files:**
- Create: `开发代码/frontend-react/src/hooks/index.ts`

**Step 1: 创建索引文件**

```typescript
// 开发代码/frontend-react/src/hooks/index.ts
/**
 * Hooks 导出索引
 */
export { useLegacyReport } from './useLegacyReport';
```

**Step 2: 提交**

```bash
cd 开发代码
git add frontend-react/src/hooks/index.ts
git commit -m "feat(hooks): add hooks index file"
```

---

## Task 6: E2E测试验证

**Files:**
- Create: `开发代码/frontend-react/tests/agency-analysis.spec.ts`

**Step 1: 创建E2E测试**

```typescript
// 开发代码/frontend-react/tests/agency-analysis.spec.ts
import { test, expect } from '@playwright/test';

test.describe('厂商分析页面测试', () => {
  test.beforeEach(async ({ page }) => {
    // 访问页面
    await page.goto('http://localhost:5173/agency-analysis');
    // 等待页面加载完成
    await page.waitForLoadState('networkidle');
    // 等待旧版 JS 加载
    await page.waitForTimeout(2000);
  });

  test('应该显示筛选器', async ({ page }) => {
    // 检查筛选器存在
    const filterBar = page.locator('.ant-card').first();
    await expect(filterBar).toBeVisible();

    // 检查平台筛选器
    const platformFilter = page.locator('text=平台:');
    await expect(platformFilter).toBeVisible();
  });

  test('应该显示汇总统计卡片', async ({ page }) => {
    // 检查统计卡片
    const totalCost = page.locator('text=总花费');
    await expect(totalCost).toBeVisible();

    const totalImpressions = page.locator('text=总曝光');
    await expect(totalImpressions).toBeVisible();
  });

  test('应该显示日级趋势图', async ({ page }) => {
    // 检查趋势图容器
    const chartContainer = page.locator('#trendChart');
    await expect(chartContainer).toBeVisible();

    // 检查图表标题
    const chartTitle = page.locator('text=日级趋势图');
    await expect(chartTitle).toBeVisible();
  });

  test('应该显示聚合数据表格', async ({ page }) => {
    // 检查表格容器
    const tableContainer = page.locator('#agencyTable');
    await expect(tableContainer).toBeVisible();

    // 检查表格标题
    const tableTitle = page.locator('text=平台×代理商聚合数据');
    await expect(tableTitle).toBeVisible();
  });

  test('筛选器查询应该刷新图表和表格', async ({ page }) => {
    // 点击查询按钮
    const searchButton = page.locator('button:has-text("查询")');
    await searchButton.click();

    // 等待数据加载
    await page.waitForTimeout(2000);

    // 检查加载状态消失
    const loadingSpinner = page.locator('.ant-spin-spinning');
    await expect(loadingSpinner).not.toBeVisible({ timeout: 10000 });
  });

  test('指标切换应该更新图表', async ({ page }) => {
    // 找到指标切换组件
    const metricSelector = page.locator('.ant-segmented').first();

    // 点击"曝光"选项
    const impressionsOption = metricSelector.locator('text=曝光');
    await impressionsOption.click();

    // 等待图表更新
    await page.waitForTimeout(500);

    // 验证选中状态
    await expect(impressionsOption).toHaveAttribute('aria-checked', 'true');
  });

  test('导出按钮应该可用', async ({ page }) => {
    // 检查导出按钮存在
    const exportButton = page.locator('button:has-text("导出Excel")');
    await expect(exportButton).toBeVisible();

    // 按钮应该可用（非禁用状态）
    await expect(exportButton).not.toBeDisabled();
  });
});
```

**Step 2: 运行E2E测试**

```bash
cd 开发代码/frontend-react
npx playwright test tests/agency-analysis.spec.ts --headed
```

Expected: All tests PASS

**Step 3: 提交**

```bash
cd 开发代码
git add frontend-react/tests/agency-analysis.spec.ts
git commit -m "test(e2e): add agency analysis page tests"
```

---

## 验证清单

### 功能验证

- [ ] 筛选器显示正常（平台、代理商、业务模式、日期范围）
- [ ] 筛选器查询功能正常
- [ ] 筛选器重置功能正常
- [ ] 汇总统计卡片数据正确
- [ ] 日级趋势图渲染正常
- [ ] 指标切换功能正常（花费、曝光、点击、线索、开户、有效户）
- [ ] 平台×代理商聚合表格渲染正常
- [ ] 表格排序功能正常
- [ ] 导出Excel功能正常

### 性能验证

- [ ] 页面加载时间 < 2s
- [ ] 筛选响应时间 < 500ms
- [ ] 图表渲染时间 < 1s

### 兼容性验证

- [ ] Chrome 90+
- [ ] Firefox 90+
- [ ] Edge 90+

---

## 风险与应对

| 风险 | 应对措施 |
|------|----------|
| 旧版 JS 文件加载失败 | 使用 legacyLoader.ts 提供错误处理和重试机制 |
| 图表容器 ID 冲突 | 确保 `#trendChart` 和 `#agencyTable` ID 唯一 |
| 内存泄漏 | useLegacyReport Hook 在组件卸载时调用 destroy() |
| 样式冲突 | 使用 CSS Modules 隔离样式 |