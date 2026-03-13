# 员工转化分析页面迁移实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将原生JS版本的员工转化分析页面迁移至React前端，实现员工维度转化数据分析

**Architecture:** React组件化架构，支持员工筛选、时间筛选、转化漏斗、趋势图

**Tech Stack:** React 19, TypeScript 5, Ant Design, ECharts/@ant-design/charts

---

## Task 1: 创建类型定义

**Files:**
- Modify: `src/types/api.schemas.ts`

```typescript
// 员工转化分析API类型

export interface PostEmployeeConversionAnalysisBody {
  start_date: string;
  end_date: string;
  employee_no?: string;
  department?: string;
}

export interface EmployeeConversionMetrics {
  employee_no: string;
  employee_name: string;
  department: string;
  leads_count: number;
  valid_leads_count: number;
  opened_accounts: number;
  valid_customers: number;
  total_assets: number;
  total_contribution: number;
  conversion_rate: number;
  valid_rate: number;
}

export interface EmployeeFunnelData {
  stage: string;
  count: number;
  rate: number;
}

export interface EmployeeTrendData {
  dates: string[];
  series: {
    name: string;
    data: number[];
  }[];
}

export interface EmployeeConversionAnalysisResponse {
  summary: EmployeeConversionMetrics[];
  funnel: EmployeeFunnelData[];
  trend: EmployeeTrendData;
  comparison?: {
    previous_period: EmployeeConversionMetrics[];
  };
}
```

---

## Task 2: 创建Hooks

**Files:**
- Create: `src/pages/EmployeeConversion/Analysis/hooks/useEmployeeAnalysis.ts`

```typescript
import { useState, useCallback } from 'react';
import { apiClient } from '@/utils/api';
import type { PostEmployeeConversionAnalysisBody, EmployeeConversionAnalysisResponse } from '@/types/api.schemas';

export function useEmployeeAnalysis() {
  const [data, setData] = useState<EmployeeConversionAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (params: PostEmployeeConversionAnalysisBody) => {
    setLoading(true);
    try {
      const response = await apiClient.post<EmployeeConversionAnalysisResponse>(
        '/api/v1/employee-conversion/analysis',
        params
      );
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, fetchData };
}
```

---

## Task 3: 创建主页面

**Files:**
- Create: `src/pages/EmployeeConversion/Analysis/index.tsx`

```typescript
/**
 * 员工转化分析页面
 */
import React, { useEffect, useState, useCallback } from 'react';
import { Card, Row, Col, Select, DatePicker, Table, Statistic } from 'antd';
import { UserOutlined, TeamOutlined, TrophyOutlined, DollarOutlined } from '@ant-design/icons';
import { FilterBar } from '@/components';
import FunnelChart from './components/FunnelChart';
import TrendChart from './components/TrendChart';
import { useEmployeeAnalysis } from './hooks';
import styles from './index.module.scss';

const { RangePicker } = DatePicker;

const EmployeeConversionAnalysisPage: React.FC = () => {
  const [dateRange, setDateRange] = useState<[string, string]>(['', '']);
  const [employeeNo, setEmployeeNo] = useState<string>();

  const { data, loading, fetchData } = useEmployeeAnalysis();

  useEffect(() => {
    // 默认最近30天
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    setDateRange([
      thirtyDaysAgo.toISOString().split('T')[0],
      today.toISOString().split('T')[0],
    ]);
  }, []);

  useEffect(() => {
    if (dateRange[0] && dateRange[1]) {
      fetchData({
        start_date: dateRange[0],
        end_date: dateRange[1],
        employee_no: employeeNo,
      });
    }
  }, [dateRange, employeeNo]);

  const columns = [
    { title: '员工编号', dataIndex: 'employee_no', key: 'employee_no', width: 100 },
    { title: '员工姓名', dataIndex: 'employee_name', key: 'employee_name', width: 100 },
    { title: '部门', dataIndex: 'department', key: 'department', width: 100 },
    { title: '线索数', dataIndex: 'leads_count', key: 'leads_count', width: 80 },
    { title: '有效线索', dataIndex: 'valid_leads_count', key: 'valid_leads_count', width: 90 },
    { title: '开户数', dataIndex: 'opened_accounts', key: 'opened_accounts', width: 80 },
    { title: '有效户', dataIndex: 'valid_customers', key: 'valid_customers', width: 80 },
    { title: '转化率', dataIndex: 'conversion_rate', key: 'conversion_rate', width: 100, render: (v: number) => `${(v * 100).toFixed(2)}%` },
    { title: '总资产', dataIndex: 'total_assets', key: 'total_assets', width: 120, render: (v: number) => `¥${v?.toLocaleString()}` },
  ];

  const totalLeads = data?.summary?.reduce((sum, item) => sum + item.leads_count, 0) || 0;
  const totalAccounts = data?.summary?.reduce((sum, item) => sum + item.opened_accounts, 0) || 0;
  const totalAssets = data?.summary?.reduce((sum, item) => sum + item.total_assets, 0) || 0;

  return (
    <div className={styles.analysisPage}>
      {/* 筛选器 */}
      <Card className={styles.filterCard}>
        <Row gutter={16} align="middle">
          <Col>
            <RangePicker
              value={dateRange as any}
              onChange={(dates) => {
                if (dates) {
                  setDateRange([dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')]);
                }
              }}
            />
          </Col>
          <Col>
            <Select
              placeholder="选择员工"
              style={{ width: 200 }}
              allowClear
              onChange={setEmployeeNo}
            />
          </Col>
        </Row>
      </Card>

      {/* 汇总统计 */}
      <Row gutter={16} className={styles.summaryRow}>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="总线索" value={totalLeads} prefix={<UserOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="总开户" value={totalAccounts} prefix={<TeamOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="总资产" value={totalAssets} prefix={<DollarOutlined />} formatter={(v) => `¥${Number(v).toLocaleString()}`} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="平均转化率" value={data?.summary?.[0]?.conversion_rate ? (data.summary[0].conversion_rate * 100).toFixed(2) : 0} suffix="%" prefix={<TrophyOutlined />} />
          </Card>
        </Col>
      </Row>

      {/* 转化漏斗 */}
      <Card className={styles.chartCard}>
        <h3>转化漏斗</h3>
        <FunnelChart data={data?.funnel || []} loading={loading} />
      </Card>

      {/* 趋势图 */}
      <Card className={styles.chartCard}>
        <h3>转化趋势</h3>
        <TrendChart data={data?.trend || null} loading={loading} />
      </Card>

      {/* 数据表格 */}
      <Card className={styles.tableCard}>
        <h3>员工数据明细</h3>
        <Table
          columns={columns}
          dataSource={data?.summary || []}
          rowKey="employee_no"
          loading={loading}
          scroll={{ x: 1000 }}
        />
      </Card>
    </div>
  );
};

export default EmployeeConversionAnalysisPage;
```

---

## Task 4: 注册路由

**Files:**
- Modify: `src/router/index.tsx`

```typescript
import EmployeeConversionAnalysisPage from '@/pages/EmployeeConversion/Analysis';

{
  path: '/employee-conversion/analysis',
  element: <EmployeeConversionAnalysisPage />,
}
```

---

## 验收标准

- [ ] 员工筛选功能正常
- [ ] 日期范围筛选正常
- [ ] 转化漏斗显示正确
- [ ] 趋势图功能正常
- [ ] 数据表格分页正常

---

**最后更新**: 2026-03-13