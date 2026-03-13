# 员工转化周报页面迁移实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将原生JS版本的员工转化周报页面迁移至React前端，实现周报生成、预览、导出功能

**Architecture:** React组件化架构，支持多种导出格式（复制、Word、Excel、海报），使用模板引擎生成报告

**Tech Stack:** React 19, TypeScript 5, Ant Design, html2canvas, docx, xlsx

---

## Task 1: 创建类型定义

**Files:**
- Modify: `src/types/api.schemas.ts`

```typescript
// 员工转化周报API类型

export interface PostEmployeeConversionWeeklyBody {
  start_date: string;
  end_date: string;
  platforms?: string[];
  top_count?: number;
}

export interface EmployeeWeeklyData {
  employee_name: string;
  employee_no: string;
  leads_count: number;
  valid_leads_count: number;
  opened_accounts: number;
  valid_customers: number;
  assets: number;
  contribution: number;
  rank: number;
}

export interface WeeklyReportSummary {
  total_leads: number;
  total_valid_leads: number;
  total_opened_accounts: number;
  total_valid_customers: number;
  total_assets: number;
  total_contribution: number;
  wow_change: {
    leads: number;
    valid_leads: number;
    opened_accounts: number;
    valid_customers: number;
  };
}

export interface EmployeeConversionWeeklyResponse {
  summary: WeeklyReportSummary;
  employee_ranking: EmployeeWeeklyData[];
  period: {
    start_date: string;
    end_date: string;
  };
}
```

---

## Task 2: 创建周报组件

**Files:**
- Create: `src/pages/EmployeeConversion/Weekly/components/WeeklyReportPreview.tsx`
- Create: `src/pages/EmployeeConversion/Weekly/components/ExportOptions.tsx`

```typescript
// WeeklyReportPreview.tsx
import React from 'react';
import { Card, Table, Statistic, Row, Col, Typography } from 'antd';
import type { EmployeeConversionWeeklyResponse } from '@/types/api.schemas';

interface WeeklyReportPreviewProps {
  data: EmployeeConversionWeeklyResponse | null;
  loading: boolean;
}

const WeeklyReportPreview: React.FC<WeeklyReportPreviewProps> = ({ data, loading }) => {
  if (!data) return null;

  const columns = [
    { title: '排名', dataIndex: 'rank', key: 'rank', width: 60 },
    { title: '员工姓名', dataIndex: 'employee_name', key: 'employee_name', width: 100 },
    { title: '员工编号', dataIndex: 'employee_no', key: 'employee_no', width: 100 },
    { title: '线索数', dataIndex: 'leads_count', key: 'leads_count', width: 80 },
    { title: '有效线索', dataIndex: 'valid_leads_count', key: 'valid_leads_count', width: 90 },
    { title: '开户数', dataIndex: 'opened_accounts', key: 'opened_accounts', width: 80 },
    { title: '有效户', dataIndex: 'valid_customers', key: 'valid_customers', width: 80 },
    { title: '资产', dataIndex: 'assets', key: 'assets', width: 120, render: (v: number) => `¥${v?.toLocaleString()}` },
    { title: '贡献', dataIndex: 'contribution', key: 'contribution', width: 120, render: (v: number) => `¥${v?.toLocaleString()}` },
  ];

  return (
    <div>
      {/* 汇总统计 */}
      <Card>
        <Row gutter={16}>
          <Col span={6}><Statistic title="总线索" value={data.summary.total_leads} /></Col>
          <Col span={6}><Statistic title="有效线索" value={data.summary.total_valid_leads} /></Col>
          <Col span={6}><Statistic title="开户数" value={data.summary.total_opened_accounts} /></Col>
          <Col span={6}><Statistic title="有效户" value={data.summary.total_valid_customers} /></Col>
        </Row>
      </Card>

      {/* 员工排名表 */}
      <Card style={{ marginTop: 16 }}>
        <Table columns={columns} dataSource={data.employee_ranking} rowKey="employee_no" loading={loading} />
      </Card>
    </div>
  );
};

export default WeeklyReportPreview;
```

---

## Task 3: 创建导出工具

**Files:**
- Create: `src/pages/EmployeeConversion/Weekly/utils/exportUtils.ts`

```typescript
/**
 * 导出工具函数
 */
import html2canvas from 'html2canvas';
import { Document, Packer, Paragraph, Table } from 'docx';
import * as XLSX from 'xlsx';

export const exportToWord = async (data: any) => {
  // Word导出逻辑
};

export const exportToExcel = (data: any) => {
  const ws = XLSX.utils.json_to_sheet(data.employee_ranking);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '员工转化周报');
  XLSX.writeFile(wb, '员工转化周报.xlsx');
};

export const exportToImage = async (elementId: string) => {
  const element = document.getElementById(elementId);
  if (!element) return;
  const canvas = await html2canvas(element);
  const link = document.createElement('a');
  link.download = '周报.png';
  link.href = canvas.toDataURL();
  link.click();
};

export const copyToClipboard = async (data: any) => {
  // 复制到剪贴板逻辑
};
```

---

## Task 4: 创建主页面

**Files:**
- Create: `src/pages/EmployeeConversion/Weekly/index.tsx`

```typescript
/**
 * 员工转化周报页面
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Card, DatePicker, Button, Space, Select, message } from 'antd';
import { CopyOutlined, FileWordOutlined, FileExcelOutlined, PictureOutlined } from '@ant-design/icons';
import WeeklyReportPreview from './components/WeeklyReportPreview';
import { useEmployeeWeekly } from './hooks';
import { exportToWord, exportToExcel, exportToImage, copyToClipboard } from './utils/exportUtils';
import styles from './index.module.scss';

const { RangePicker } = DatePicker;

const EmployeeConversionWeeklyPage: React.FC = () => {
  const [dateRange, setDateRange] = useState<[string, string]>(['', '']);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [topCount, setTopCount] = useState(10);

  const { data, loading, fetchData } = useEmployeeWeekly();

  // 获取上周日期范围（周一到周日）
  useEffect(() => {
    const today = new Date();
    const lastMonday = new Date(today);
    lastMonday.setDate(today.getDate() - today.getDay() - 6);
    const lastSunday = new Date(lastMonday);
    lastSunday.setDate(lastMonday.getDate() + 6);

    const formatDate = (d: Date) => d.toISOString().split('T')[0];
    setDateRange([formatDate(lastMonday), formatDate(lastSunday)]);
  }, []);

  useEffect(() => {
    if (dateRange[0] && dateRange[1]) {
      fetchData({
        start_date: dateRange[0],
        end_date: dateRange[1],
        platforms,
        top_count: topCount,
      });
    }
  }, [dateRange, platforms, topCount]);

  const handleExport = useCallback((type: 'copy' | 'word' | 'excel' | 'image') => {
    if (!data) return;

    switch (type) {
      case 'copy':
        copyToClipboard(data);
        message.success('已复制到剪贴板');
        break;
      case 'word':
        exportToWord(data);
        break;
      case 'excel':
        exportToExcel(data);
        break;
      case 'image':
        exportToImage('weekly-report');
        break;
    }
  }, [data]);

  return (
    <div className={styles.weeklyPage}>
      <Card className={styles.controlCard}>
        <Space wrap>
          <RangePicker
            value={dateRange as any}
            onChange={(dates) => {
              if (dates) {
                setDateRange([dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')]);
              }
            }}
          />
          <Select mode="multiple" placeholder="选择平台" style={{ width: 200 }} onChange={setPlatforms} />
          <Select placeholder="TOP数量" style={{ width: 120 }} value={topCount} onChange={setTopCount}>
            <Select.Option value={10}>TOP 10</Select.Option>
            <Select.Option value={20}>TOP 20</Select.Option>
            <Select.Option value={50}>TOP 50</Select.Option>
          </Select>
        </Space>
        <Space style={{ marginLeft: 'auto' }}>
          <Button icon={<CopyOutlined />} onClick={() => handleExport('copy')}>复制</Button>
          <Button icon={<FileWordOutlined />} onClick={() => handleExport('word')}>导出Word</Button>
          <Button icon={<FileExcelOutlined />} onClick={() => handleExport('excel')}>导出Excel</Button>
          <Button icon={<PictureOutlined />} onClick={() => handleExport('image')}>生成海报</Button>
        </Space>
      </Card>

      <div id="weekly-report">
        <WeeklyReportPreview data={data} loading={loading} />
      </div>
    </div>
  );
};

export default EmployeeConversionWeeklyPage;
```

---

## Task 5: 注册路由

**Files:**
- Modify: `src/router/index.tsx`

```typescript
import EmployeeConversionWeeklyPage from '@/pages/EmployeeConversion/Weekly';

// 添加路由
{
  path: '/employee-conversion/weekly',
  element: <EmployeeConversionWeeklyPage />,
}
```

---

## 验收标准

- [ ] 默认日期范围为上周一到周日
- [ ] 四种导出方式全部正常
- [ ] 筛选器功能正常
- [ ] 响应式布局正常

---

**最后更新**: 2026-03-13