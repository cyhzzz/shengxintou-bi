# 报告生成页面迁移实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将原生JS版本的报告生成页面迁移至React前端，实现自定义报告生成、预览和导出功能

**Architecture:** React组件化架构，支持报告配置、数据收集、HTML预览、多格式导出

**Tech Stack:** React 19, TypeScript 5, Ant Design (Form, Input, Radio, Checkbox, Button, Card, Spin, message)

---

## ⚠️ 关键迁移点

### 功能模块

| 模块 | 功能 | 说明 |
|------|------|------|
| 报告配置 | 标题、格式、包含内容 | 可配置报告参数 |
| 数据收集 | 从多个API收集数据 | summary, trend, comparison, funnel, external |
| 报告生成 | 构建HTML报告 | 根据配置生成报告内容 |
| 报告预览 | iframe预览 | 在iframe中渲染HTML |
| 报告导出 | 多格式导出 | PDF/Excel/HTML |

### 报告配置选项

- **标题**: 报告标题
- **格式**: PDF/Excel/HTML
- **包含内容**:
  - 数据概览 (includeSummary)
  - 趋势分析 (includeTrends)
  - 对比分析 (includeComparison)
  - 图表展示 (includeCharts)

---

## Task 1: 创建类型定义

**Files:**
- Modify: `src/types/api.schemas.ts`

```typescript
// 报告生成API类型

export interface ReportConfig {
  title: string;
  format: 'pdf' | 'excel' | 'html';
  includeSummary: boolean;
  includeTrends: boolean;
  includeComparison: boolean;
  includeCharts: boolean;
}

export interface ReportData {
  summary: SummaryResponse | null;
  trend: TrendResponse | null;
  comparison: ConversionFunnelResponse | null;
  funnel: ConversionFunnelResponse | null;
  external: ExternalDataAnalysisResponse | null;
}

export interface SummaryResponse {
  success: boolean;
  data: Array<{
    platform: string;
    metrics: {
      cost: number;
      impressions: number;
      clicks: number;
      leads: number;
      new_accounts: number;
    };
  }>;
}

export interface TrendResponse {
  dates: string[];
  series: Array<{
    name: string;
    metric?: string;
    data: number[];
  }>;
}

export interface ConversionFunnelResponse {
  platform_funnel: Array<{
    platform: string;
    impressions: number;
    clicks: number;
    leads: number;
    new_accounts: number;
    rates: {
      overall_conversion_rate: number;
    };
  }>;
}

export interface ExternalDataAnalysisResponse {
  roi_analysis?: {
    roi: number;
    total_investment: number;
    total_returns: number;
    metrics: {
      cost_per_account: number;
    };
  };
  agency_ranking?: Array<{
    agency: string;
    score: number;
    metrics: {
      new_accounts: number;
      cost_per_account: number;
    };
  }>;
}
```

---

## Task 2: 创建报告配置组件

**Files:**
- Create: `src/pages/System/ReportGeneration/components/ReportConfigForm.tsx`

```typescript
/**
 * 报告配置表单
 */
import React from 'react';
import { Form, Input, Radio, Checkbox, Button, Space } from 'antd';

interface ReportConfigFormProps {
  config: {
    title: string;
    format: 'pdf' | 'excel' | 'html';
    includeSummary: boolean;
    includeTrends: boolean;
    includeComparison: boolean;
    includeCharts: boolean;
  };
  onConfigChange: (key: string, value: string | boolean) => void;
  onGenerate: () => void;
  loading: boolean;
}

const ReportConfigForm: React.FC<ReportConfigFormProps> = ({
  config,
  onConfigChange,
  onGenerate,
  loading,
}) => {
  return (
    <Form layout="vertical">
      <Form.Item label="报告标题">
        <Input
          value={config.title}
          onChange={(e) => onConfigChange('title', e.target.value)}
          placeholder="请输入报告标题"
        />
      </Form.Item>

      <Form.Item label="报告格式">
        <Radio.Group
          value={config.format}
          onChange={(e) => onConfigChange('format', e.target.value)}
        >
          <Radio value="pdf">PDF</Radio>
          <Radio value="excel">Excel</Radio>
          <Radio value="html">HTML</Radio>
        </Radio.Group>
      </Form.Item>

      <Form.Item label="包含内容">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          <Checkbox
            checked={config.includeSummary}
            onChange={(e) => onConfigChange('includeSummary', e.target.checked)}
          >
            数据概览
          </Checkbox>
          <Checkbox
            checked={config.includeTrends}
            onChange={(e) => onConfigChange('includeTrends', e.target.checked)}
          >
            趋势分析
          </Checkbox>
          <Checkbox
            checked={config.includeComparison}
            onChange={(e) => onConfigChange('includeComparison', e.target.checked)}
          >
            对比分析
          </Checkbox>
          <Checkbox
            checked={config.includeCharts}
            onChange={(e) => onConfigChange('includeCharts', e.target.checked)}
          >
            图表展示
          </Checkbox>
        </div>
      </Form.Item>

      <Form.Item>
        <Button type="primary" size="large" onClick={onGenerate} loading={loading}>
          生成报告
        </Button>
      </Form.Item>
    </Form>
  );
};

export default ReportConfigForm;
```

---

## Task 3: 创建报告预览组件

**Files:**
- Create: `src/pages/System/ReportGeneration/components/ReportPreview.tsx`

```typescript
/**
 * 报告预览组件
 */
import React from 'react';
import { Empty, Spin } from 'antd';

interface ReportPreviewProps {
  reportHtml: string | null;
  loading: boolean;
}

const ReportPreview: React.FC<ReportPreviewProps> = ({ reportHtml, loading }) => {
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <Spin size="large" />
        <p style={{ marginTop: 16, color: '#666' }}>正在生成报告...</p>
      </div>
    );
  }

  if (!reportHtml) {
    return (
      <Empty
        style={{ padding: '60px 20px' }}
        image="📄"
        description="点击"生成报告"按钮开始生成报告"
      />
    );
  }

  return (
    <iframe
      srcDoc={reportHtml}
      style={{
        width: '100%',
        height: 800,
        border: '1px solid #e0e0e0',
      }}
      title="报告预览"
    />
  );
};

export default ReportPreview;
```

---

## Task 4: 创建报告导出组件

**Files:**
- Create: `src/pages/System/ReportGeneration/components/ExportButtons.tsx`

```typescript
/**
 * 报告导出按钮组
 */
import React from 'react';
import { Button, Space, message } from 'antd';
import { FilePdfOutlined, FileExcelOutlined, FileTextOutlined } from '@ant-design/icons';

interface ExportButtonsProps {
  reportHtml: string | null;
  title: string;
}

const ExportButtons: React.FC<ExportButtonsProps> = ({ reportHtml, title }) => {
  const downloadHtml = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExport = (format: 'pdf' | 'excel' | 'html') => {
    if (!reportHtml) {
      message.warning('请先生成报告');
      return;
    }

    const filename = `${title}_${Date.now()}`;

    switch (format) {
      case 'html':
        downloadHtml(reportHtml, filename);
        break;
      case 'pdf':
        message.info(
          'PDF导出功能需要后端支持，当前已生成HTML预览。请使用浏览器的打印功能（Ctrl+P）并选择"另存为PDF"来导出PDF。'
        );
        break;
      case 'excel':
        message.info('Excel导出功能正在开发中，请使用HTML格式导出。');
        break;
    }
  };

  return (
    <Space>
      <Button
        type="primary"
        icon={<FilePdfOutlined />}
        onClick={() => handleExport('pdf')}
      >
        导出 PDF
      </Button>
      <Button
        type="primary"
        icon={<FileExcelOutlined />}
        onClick={() => handleExport('excel')}
      >
        导出 Excel
      </Button>
      <Button
        icon={<FileTextOutlined />}
        onClick={() => handleExport('html')}
      >
        导出 HTML
      </Button>
    </Space>
  );
};

export default ExportButtons;
```

---

## Task 5: 创建报告构建工具

**Files:**
- Create: `src/pages/System/ReportGeneration/utils/reportBuilder.ts`

```typescript
/**
 * 报告构建工具
 */
import type { ReportConfig, ReportData } from '@/types/api.schemas';

export function buildReport(
  config: ReportConfig,
  data: ReportData,
  filters: { date_range?: [string, string] }
): string {
  const now = new Date();
  const reportDate = now.toLocaleDateString('zh-CN');
  const reportTime = now.toLocaleTimeString('zh-CN');

  let html = `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <title>${config.title}</title>
      <style>
        body {
          font-family: 'Microsoft YaHei', Arial, sans-serif;
          margin: 0;
          padding: 20px;
          background: #f5f5f5;
        }
        .report-container {
          max-width: 1200px;
          margin: 0 auto;
          background: white;
          padding: 40px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .report-header {
          text-align: center;
          border-bottom: 2px solid #409EFF;
          padding-bottom: 20px;
          margin-bottom: 30px;
        }
        .report-title {
          font-size: 32px;
          color: #303133;
          margin: 0 0 10px 0;
        }
        .report-meta {
          color: #909399;
          font-size: 14px;
        }
        .report-section {
          margin-bottom: 40px;
        }
        .section-title {
          font-size: 24px;
          color: #409EFF;
          border-left: 4px solid #409EFF;
          padding-left: 12px;
          margin-bottom: 20px;
        }
        .metric-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
          margin-bottom: 20px;
        }
        .metric-card {
          background: #f9f9f9;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 20px;
          text-align: center;
        }
        .metric-value {
          font-size: 28px;
          font-weight: bold;
          color: #409EFF;
          margin: 10px 0;
        }
        .metric-label {
          color: #606266;
          font-size: 14px;
        }
        .data-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
        }
        .data-table th,
        .data-table td {
          border: 1px solid #e0e0e0;
          padding: 12px;
          text-align: left;
        }
        .data-table th {
          background: #f5f7fa;
          font-weight: bold;
          color: #303133;
        }
        .data-table tr:nth-child(even) {
          background: #fafafa;
        }
        .report-footer {
          text-align: center;
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #e0e0e0;
          color: #909399;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div class="report-container">
        <div class="report-header">
          <h1 class="report-title">${config.title}</h1>
          <div class="report-meta">
            生成时间: ${reportDate} ${reportTime}
            <br>
            数据范围: ${filters.date_range ? filters.date_range[0] + ' 至 ' + filters.date_range[1] : '全部'}
          </div>
        </div>
  `;

  // 数据概览
  if (config.includeSummary && data.summary?.data) {
    html += buildSummarySection(data.summary);
  }

  // 趋势分析
  if (config.includeTrends && data.trend) {
    html += buildTrendSection(data.trend, config.includeCharts);
  }

  // 对比分析
  if (config.includeComparison && data.comparison) {
    html += buildComparisonSection(data.comparison);
  }

  html += `
        <div class="report-footer">
          <p>本报告由省心投 BI 系统自动生成</p>
          <p>© ${now.getFullYear()} 省心投. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return html;
}

function buildSummarySection(summary: { data: Array<{ metrics: { cost: number; impressions: number; clicks: number; leads: number; new_accounts: number } }> }): string {
  const totals = summary.data.reduce((acc, item) => {
    acc.cost += item.metrics.cost || 0;
    acc.impressions += item.metrics.impressions || 0;
    acc.clicks += item.metrics.clicks || 0;
    acc.leads += item.metrics.leads || 0;
    acc.accounts += item.metrics.new_accounts || 0;
    return acc;
  }, { cost: 0, impressions: 0, clicks: 0, leads: 0, accounts: 0 });

  return `
    <div class="report-section">
      <h2 class="section-title">一、数据概览</h2>
      <div class="metric-grid">
        <div class="metric-card">
          <div class="metric-label">总花费</div>
          <div class="metric-value">¥${totals.cost.toLocaleString()}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">总曝光</div>
          <div class="metric-value">${totals.impressions.toLocaleString()}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">总点击</div>
          <div class="metric-value">${totals.clicks.toLocaleString()}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">线索数</div>
          <div class="metric-value">${totals.leads.toLocaleString()}</div>
        </div>
      </div>
    </div>
  `;
}

function buildTrendSection(trend: { dates: string[]; series: Array<{ name: string; metric?: string; data: number[] }> }, includeCharts: boolean): string {
  const series = Array.isArray(trend.series) ? trend.series : [];

  const getValue = (metricName: string, dateIndex: number): number => {
    const metricSeries = series.find(s => s.name === metricName || s.metric === metricName);
    if (metricSeries && Array.isArray(metricSeries.data)) {
      return metricSeries.data[dateIndex] || 0;
    }
    return 0;
  };

  return `
    <div class="report-section">
      <h2 class="section-title">二、趋势分析</h2>
      ${includeCharts ? '<div style="background: #f9f9f9; border: 1px dashed #ccc; height: 300px; display: flex; align-items: center; justify-content: center; color: #909399;">趋势图表区域</div>' : ''}
      <table class="data-table">
        <thead>
          <tr>
            <th>日期</th>
            <th>花费(¥)</th>
            <th>曝光</th>
            <th>点击</th>
            <th>线索</th>
            <th>开户</th>
          </tr>
        </thead>
        <tbody>
          ${trend.dates.map((date, i) => `
            <tr>
              <td>${date}</td>
              <td>${getValue('cost', i).toLocaleString()}</td>
              <td>${getValue('impressions', i).toLocaleString()}</td>
              <td>${getValue('clicks', i).toLocaleString()}</td>
              <td>${getValue('leads', i).toLocaleString()}</td>
              <td>${getValue('new_accounts', i).toLocaleString()}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function buildComparisonSection(comparison: { platform_funnel: Array<{ platform: string; impressions: number; clicks: number; leads: number; new_accounts: number; rates: { overall_conversion_rate: number } }> }): string {
  return `
    <div class="report-section">
      <h2 class="section-title">三、转化漏斗分析</h2>
      <table class="data-table">
        <thead>
          <tr>
            <th>平台</th>
            <th>曝光</th>
            <th>点击</th>
            <th>线索</th>
            <th>开户</th>
            <th>总转化率</th>
          </tr>
        </thead>
        <tbody>
          ${comparison.platform_funnel.map(p => `
            <tr>
              <td>${p.platform}</td>
              <td>${p.impressions.toLocaleString()}</td>
              <td>${p.clicks.toLocaleString()}</td>
              <td>${p.leads.toLocaleString()}</td>
              <td>${p.new_accounts.toLocaleString()}</td>
              <td>${p.rates.overall_conversion_rate.toFixed(2)}%</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}
```

---

## Task 6: 创建主页面

**Files:**
- Create: `src/pages/System/ReportGeneration/index.tsx`

```typescript
/**
 * 报告生成页面
 */
import React, { useState, useCallback } from 'react';
import { Card, message } from 'antd';
import ReportConfigForm from './components/ReportConfigForm';
import ReportPreview from './components/ReportPreview';
import ExportButtons from './components/ExportButtons';
import { buildReport } from './utils/reportBuilder';
import { apiClient } from '@/utils/api';
import type { ReportConfig, ReportData } from '@/types/api.schemas';
import styles from './index.module.scss';

const defaultConfig: ReportConfig = {
  title: '省心投 BI 分析报告',
  format: 'pdf',
  includeSummary: true,
  includeTrends: true,
  includeComparison: true,
  includeCharts: true,
};

const ReportGenerationPage: React.FC = () => {
  const [config, setConfig] = useState<ReportConfig>(defaultConfig);
  const [reportHtml, setReportHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleConfigChange = useCallback((key: string, value: string | boolean) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }, []);

  const collectReportData = useCallback(async (filters: { platforms?: string[]; date_range?: [string, string] }): Promise<ReportData> => {
    const data: ReportData = {
      summary: null,
      trend: null,
      comparison: null,
      funnel: null,
      external: null,
    };

    // 收集汇总数据
    if (config.includeSummary) {
      try {
        data.summary = await apiClient.post('/api/v1/summary', { filters });
      } catch (e) {
        console.error('获取汇总数据失败:', e);
      }
    }

    // 收集趋势数据
    if (config.includeTrends) {
      try {
        data.trend = await apiClient.post('/api/v1/trend', {
          filters,
          metrics: ['cost', 'impressions', 'clicks', 'leads', 'new_accounts'],
        });
      } catch (e) {
        console.error('获取趋势数据失败:', e);
      }
    }

    // 收集对比数据
    if (config.includeComparison) {
      try {
        data.comparison = await apiClient.post('/api/v1/conversion-funnel', { filters });
      } catch (e) {
        console.error('获取对比数据失败:', e);
      }
    }

    // 收集外部分析数据
    try {
      data.external = await apiClient.post('/api/v1/external-data-analysis', { filters });
    } catch (e) {
      console.error('获取外部分析数据失败:', e);
    }

    return data;
  }, [config]);

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    try {
      // 获取筛选条件 (这里简化处理，实际应从全局筛选器获取)
      const filters = {
        date_range: undefined as [string, string] | undefined,
      };

      // 收集报告数据
      const data = await collectReportData(filters);

      // 生成报告
      const html = buildReport(config, data, filters);
      setReportHtml(html);

      message.success('报告生成成功');
    } catch (error) {
      console.error('报告生成失败:', error);
      message.error('报告生成失败');
    } finally {
      setLoading(false);
    }
  }, [config, collectReportData]);

  return (
    <div className={styles.reportGenerationPage}>
      {/* 报告配置卡片 */}
      <Card className={styles.configCard}>
        <div className={styles.cardHeader}>
          <h3>报告配置</h3>
        </div>
        <ReportConfigForm
          config={config}
          onConfigChange={handleConfigChange}
          onGenerate={handleGenerate}
          loading={loading}
        />
      </Card>

      {/* 报告预览卡片 */}
      <Card className={styles.previewCard}>
        <div className={styles.cardHeader}>
          <h3>报告预览</h3>
        </div>
        <ReportPreview reportHtml={reportHtml} loading={loading} />
      </Card>

      {/* 导出操作卡片 */}
      {reportHtml && (
        <Card className={styles.exportCard}>
          <div className={styles.cardHeader}>
            <h3>导出报告</h3>
          </div>
          <ExportButtons reportHtml={reportHtml} title={config.title} />
        </Card>
      )}
    </div>
  );
};

export default ReportGenerationPage;
```

---

## Task 7: 创建样式文件

**Files:**
- Create: `src/pages/System/ReportGeneration/index.module.scss`

```scss
.reportGenerationPage {
  .configCard,
  .previewCard,
  .exportCard {
    margin-bottom: 20px;
  }

  .cardHeader {
    margin-bottom: 16px;

    h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
    }
  }
}
```

---

## Task 8: 注册路由

**Files:**
- Modify: `src/router/index.tsx`

```typescript
import ReportGenerationPage from '@/pages/System/ReportGeneration';

{
  path: '/report/generation',
  element: <ReportGenerationPage />,
}
```

---

## 验收标准

- [ ] 报告配置功能正常
- [ ] 报告生成功能正常
- [ ] 报告预览显示正确
- [ ] HTML导出功能正常
- [ ] PDF/Excel提示正确
- [ ] 无TypeScript编译错误

---

## API参数检查清单

| API端点 | 参数 | 状态 |
|--------|------|------|
| POST /api/v1/summary | filters | ✅ |
| POST /api/v1/trend | filters, metrics | ✅ |
| POST /api/v1/conversion-funnel | filters | ✅ |
| POST /api/v1/external-data-analysis | filters | ✅ |

---

**最后更新**: 2026-03-13