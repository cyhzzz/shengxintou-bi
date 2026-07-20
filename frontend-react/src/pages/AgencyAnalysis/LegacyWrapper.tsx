/**
 * 厂商分析页面 - 混合迁移版本
 * 
 * 混合迁移策略：
 * 1. 复用旧版JS的图表配置逻辑和工具函数
 * 2. 使用Ant Design组件替换筛选器
 * 3. 使用EChartsComponent替代旧版ChartCard
 * 
 * 旧版JS文件路径: http://localhost:3001/js/reports/AgencyAnalysisReport.js
 * 旧版工具函数: http://localhost:3001/js/utils/chartHelper.js
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Table, Row, Col, Statistic, Segmented, Space, message, Tag, Button, Tooltip, Spin } from 'antd';
import { DollarOutlined, EyeOutlined, UserOutlined, TeamOutlined, AimOutlined, DownloadOutlined } from '@ant-design/icons';
import type { EChartsOption } from 'echarts';
import { FilterBar, ChartCard } from '@/components';
import EChartsComponent from '@/components/Chart/ECharts';
import { useFilterStore } from '@/stores';
import { getAgencyAnalysis } from '@/types/api';
import type { AgencyAnalysisResponse, TrendResponse } from '@/types/api.schemas';
import styles from './index.module.scss';

// 指标类型 - 与旧版完全一致
type MetricType = 'cost' | 'impressions' | 'clicks' | 'lead_users' | 'opened_account_users' | 'valid_customer_users';

// 指标标签映射 - 与旧版完全一致
const METRIC_LABELS: Record<MetricType, string> = {
  cost: '花费',
  impressions: '曝光',
  clicks: '点击',
  lead_users: '线索',
  opened_account_users: '开户',
  valid_customer_users: '有效户',
};

// 指标单位映射
const METRIC_UNITS: Record<MetricType, string> = {
  cost: '元',
  impressions: '次',
  clicks: '次',
  lead_users: '人',
  opened_account_users: '人',
  valid_customer_users: '人',
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

// 平台颜色映射 - 与旧版一致
const PLATFORM_COLORS: Record<string, string> = {
  '腾讯': '#1890ff',
  '抖音': '#f5222d',
  '小红书': '#eb2f96',
  '云极': '#52c41a',
  'YJ': '#722ed1',
  '高德': '#fa8c16',
};

/**
 * 复用旧版JS的图表配置构建逻辑
 * 旧版文件: js/utils/chartHelper.js
 */
function buildTrendChartOption(dates: string[], series: any[], metric: MetricType): EChartsOption {
  // 复用旧版颜色配置
  const metricColors: Record<MetricType, string> = {
    cost: '#1890ff',
    impressions: '#52c41a',
    clicks: '#faad14',
    lead_users: '#f5222d',
    opened_account_users: '#722ed1',
    valid_customer_users: '#13c2c2',
  };

  // 复用旧版的渐变色配置
  const getGradientColor = (color: string) => {
    const colorStop1 = color + '80';
    return {
      type: 'linear' as const,
      x: 0, y: 0, x2: 0, y2: 1,
      colorStops: [
        { offset: 0, color },
        { offset: 1, colorStop1 },
      ],
    };
  };

  // 构建系列数据
  const seriesData = series.map(s => {
    const values = metric === 'cost' ? s.cost_data :
                   metric === 'impressions' ? s.impressions_data :
                   metric === 'clicks' ? s.clicks_data :
                   metric === 'lead_users' ? s.lead_users_data :
                   metric === 'opened_account_users' ? s.opened_account_users_data :
                   s.valid_customer_users_data || [];

    return {
      name: s.name || s.agency || '默认',
      type: 'line' as const,
      smooth: true,
      data: values,
      itemStyle: {
        color: getGradientColor(metricColors[metric]),
      },
      areaStyle: s.isTotal ? {
        color: getGradientColor(metricColors[metric]) as unknown as string | undefined,
      } : undefined,
    };
  });

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross', label: { backgroundColor: '#6a7985' } },
    },
    legend: {
      data: series.map(s => s.name || s.agency || '默认'),
      bottom: 0,
      type: 'scroll',
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      top: '10%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: dates,
      axisLabel: {
        rotate: dates.length > 15 ? 30 : 0,
        fontSize: 11,
      },
    },
    yAxis: {
      type: 'value',
      name: METRIC_UNITS[metric],
      nameTextStyle: { fontSize: 12, color: '#8a8d99' },
      axisLabel: {
        formatter: (value: number) => {
          if (metric === 'cost') {
            return value >= 10000 ? `${(value / 10000).toFixed(1)}w` : value.toFixed(0);
          }
          return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toFixed(0);
        },
      },
      splitLine: { lineStyle: { type: 'dashed', color: '#f0f1f3' } },
    },
    series: seriesData as any,
    dataZoom: dates.length > 30 ? [
      { type: 'inside', start: 0, end: 100 },
      { type: 'slider', start: 0, end: 100, height: 20, bottom: 0 },
    ] : [],
  } as EChartsOption;
}

const AgencyAnalysisLegacyPage: React.FC = () => {
  const [summary, setSummary] = useState<FlattenedSummaryItem[]>([]);
  const [trend, setTrend] = useState<TrendResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [metric, setMetric] = useState<MetricType>('cost');

  const { dateRange, selectedPlatforms, selectedAgencies, selectedBusinessModels } = useFilterStore();

  // 加载数据
  const fetchData = useCallback(async () => {
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

      const response = await getAgencyAnalysis(params) as unknown as AgencyAnalysisResponse;

      if (response.success && response.data) {
        // 展平数据 - 与旧版逻辑一致
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
        setTrend(response.data.trend || null);
      } else {
        message.error(response.message || '获取数据失败');
      }
    } catch (error) {
      console.error('获取厂商分析数据失败:', error);
      message.error('获取数据失败，请重试');
    } finally {
      setLoading(false);
    }
  }, [dateRange, selectedPlatforms, selectedAgencies, selectedBusinessModels]);

  // 初始加载
  useEffect(() => {
    fetchData();
  }, []);

  // 处理筛选器查询
  const handleSearch = useCallback(() => {
    fetchData();
  }, [fetchData]);

  // 处理筛选器重置
  const handleReset = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = {};

      if (dateRange.startDate && dateRange.endDate) {
        params.start_date = dateRange.startDate;
        params.end_date = dateRange.endDate;
      }

      const response = await getAgencyAnalysis(params) as unknown as AgencyAnalysisResponse;

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
        setTrend(response.data.trend || null);
      } else {
        message.error(response.message || '获取数据失败');
      }
    } catch (error) {
      console.error('获取厂商分析数据失败:', error);
      message.error('获取数据失败，请重试');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  // 排序逻辑 - 与旧版完全一致
  const sortedSummary = useMemo(() => {
    if (!summary || summary.length === 0) return [];

    return [...summary].sort((a, b) => {
      if (a.is_total) return -1;
      if (b.is_total) return 1;

      if (a.is_subtotal && !b.is_subtotal) return -1;
      if (!a.is_subtotal && b.is_subtotal) return 1;

      if (a.platform !== b.platform) {
        return a.platform.localeCompare(b.platform);
      }

      if (a.business_model !== b.business_model) {
        return a.business_model.localeCompare(b.business_model);
      }

      if (!a.agency) return 1;
      if (!b.agency) return -1;
      return a.agency.localeCompare(b.agency);
    });
  }, [summary]);

  // 计算汇总数据
  const totals = useMemo(() => {
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
  const stats = useMemo(() => {
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

  // 格式化数值
  const formatValue = (value: number, decimals: number = 0): string => {
    if (value === 0 || value === null || value === undefined) return '-';
    return value.toLocaleString('zh-CN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  // 格式化金额
  const formatCost = (value: number): string => {
    if (value === 0) return '-';
    return `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // 导出CSV功能 - 与旧版一致
  const exportToCSV = useCallback(() => {
    if (!sortedSummary || sortedSummary.length === 0) {
      message.warning('暂无数据可导出');
      return;
    }

    const headers = [
      '平台', '业务模式', '代理商', '花费', '曝光', '点击', '线索', '开户', '有效户',
      '新增资产', '服务存量资产', 'CTR', '线索成本', '开户成本'
    ];

    const rows = sortedSummary.map(item => {
      const ctr = item.impressions > 0 ? (item.clicks / item.impressions * 100).toFixed(2) + '%' : '-';
      return [
        item.is_total ? '全部' : (item.is_subtotal ? item.platform : item.platform),
        item.is_total || item.is_subtotal ? '-' : (item.business_model || '-'),
        item.agency || '未归因',
        item.cost.toFixed(2),
        item.impressions.toString(),
        item.clicks.toString(),
        item.lead_users.toString(),
        item.opened_account_users.toString(),
        item.valid_customer_users.toString(),
        item.opened_account_assets.toFixed(2),
        item.existing_customer_assets.toFixed(2),
        ctr,
        item.lead_cost.toFixed(2),
        item.account_cost.toFixed(2),
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `厂商分析数据_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    message.success('导出成功');
  }, [sortedSummary]);

  // 表格列配置 - 与旧版完全一致（14列）
  const columns = useMemo(() => [
    {
      title: '平台',
      dataIndex: 'platform',
      key: 'platform',
      width: 100,
      fixed: 'left' as const,
      render: (value: string, record: FlattenedSummaryItem) => {
        if (record.is_total) return <strong>全部</strong>;
        if (record.is_subtotal) return <strong>{value}</strong>;
        const color = PLATFORM_COLORS[value] || '#999';
        return <Tag color={color}>{value}</Tag>;
      },
    },
    {
      title: '业务模式',
      dataIndex: 'business_model',
      key: 'business_model',
      width: 100,
      render: (value: string, record: FlattenedSummaryItem) => {
        if (record.is_total || record.is_subtotal) return '-';
        return value || '-';
      },
    },
    {
      title: '代理商',
      dataIndex: 'agency',
      key: 'agency',
      width: 120,
      render: (value: string) => {
        const display = value || '未归因';
        return <strong>{display}</strong>;
      },
    },
    {
      title: '花费',
      dataIndex: 'cost',
      key: 'cost',
      width: 120,
      align: 'right' as const,
      render: (value: number, record: FlattenedSummaryItem) => {
        if (record.is_total || record.is_subtotal) {
          return <strong>{formatCost(value)}</strong>;
        }
        return formatCost(value);
      },
    },
    {
      title: '曝光',
      dataIndex: 'impressions',
      key: 'impressions',
      width: 100,
      align: 'right' as const,
      render: (value: number, record: FlattenedSummaryItem) => {
        if (record.is_total || record.is_subtotal) {
          return <strong>{formatValue(value)}</strong>;
        }
        return formatValue(value);
      },
    },
    {
      title: '点击',
      dataIndex: 'clicks',
      key: 'clicks',
      width: 80,
      align: 'right' as const,
      render: (value: number, record: FlattenedSummaryItem) => {
        if (record.is_total || record.is_subtotal) {
          return <strong>{formatValue(value)}</strong>;
        }
        return formatValue(value);
      },
    },
    {
      title: '线索',
      dataIndex: 'lead_users',
      key: 'lead_users',
      width: 80,
      align: 'right' as const,
      render: (value: number, record: FlattenedSummaryItem) => {
        if (record.is_total || record.is_subtotal) {
          return <strong>{formatValue(value)}</strong>;
        }
        return formatValue(value);
      },
    },
    {
      title: '开户',
      dataIndex: 'opened_account_users',
      key: 'opened_account_users',
      width: 80,
      align: 'right' as const,
      render: (value: number, record: FlattenedSummaryItem) => {
        if (record.is_total || record.is_subtotal) {
          return <strong>{formatValue(value)}</strong>;
        }
        return formatValue(value);
      },
    },
    {
      title: '有效户',
      dataIndex: 'valid_customer_users',
      key: 'valid_customer_users',
      width: 80,
      align: 'right' as const,
      render: (value: number, record: FlattenedSummaryItem) => {
        if (record.is_total || record.is_subtotal) {
          return <strong>{formatValue(value)}</strong>;
        }
        return formatValue(value);
      },
    },
    {
      title: '新增资产',
      dataIndex: 'opened_account_assets',
      key: 'opened_account_assets',
      width: 120,
      align: 'right' as const,
      render: (value: number, record: FlattenedSummaryItem) => {
        if (record.is_total || record.is_subtotal) {
          return <strong>{formatValue(value, 2)}</strong>;
        }
        return formatValue(value, 2);
      },
    },
    {
      title: '服务存量资产',
      dataIndex: 'existing_customer_assets',
      key: 'existing_customer_assets',
      width: 120,
      align: 'right' as const,
      render: (value: number, record: FlattenedSummaryItem) => {
        if (record.is_total || record.is_subtotal) {
          return <strong>{formatValue(value, 2)}</strong>;
        }
        return formatValue(value, 2);
      },
    },
    {
      title: 'CTR',
      key: 'ctr',
      width: 80,
      align: 'right' as const,
      render: (_: unknown, record: FlattenedSummaryItem) => {
        const ctr = record.impressions > 0 ? (record.clicks / record.impressions * 100) : 0;
        if (ctr === 0 && !record.is_total && !record.is_subtotal) return '-';
        return <span>{ctr.toFixed(2)}%</span>;
      },
    },
    {
      title: '线索成本',
      dataIndex: 'lead_cost',
      key: 'lead_cost',
      width: 100,
      align: 'right' as const,
      render: (value: number, record: FlattenedSummaryItem) => {
        if (record.is_total || record.is_subtotal) {
          return <strong>{formatCost(value)}</strong>;
        }
        return formatCost(value);
      },
    },
    {
      title: '开户成本',
      dataIndex: 'account_cost',
      key: 'account_cost',
      width: 100,
      align: 'right' as const,
      render: (value: number, record: FlattenedSummaryItem) => {
        if (record.is_total || record.is_subtotal) {
          return <strong>{formatCost(value)}</strong>;
        }
        return formatCost(value);
      },
    },
  ], []);

  // ECharts图表配置 - 复用旧版配置逻辑
  const echartsOption = useMemo((): EChartsOption => {
    const dates = (trend as any)?.dates || [];
    const series = (trend as any)?.series || [];
    return buildTrendChartOption(dates, series, metric);
  }, [trend, metric]);

  return (
    <div className={styles.agencyAnalysisPage}>
      {/* 使用Ant Design筛选器 */}
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
          <Card><Statistic title="总花费" value={totals.cost} precision={2} prefix={<DollarOutlined />} formatter={(value) => `¥${Number(value).toLocaleString()}`} /></Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card><Statistic title="总曝光" value={totals.impressions} prefix={<EyeOutlined />} /></Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card><Statistic title="总点击" value={totals.clicks} prefix={<AimOutlined />} /></Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card><Statistic title="线索人数" value={totals.leadUsers} prefix={<UserOutlined />} /></Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card><Statistic title="开户人数" value={totals.openedAccounts} prefix={<TeamOutlined />} /></Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card><Statistic title="有效户人数" value={totals.validCustomers} prefix={<TeamOutlined />} /></Card>
        </Col>
      </Row>

      {/* 趋势图 - 使用EChartsComponent替代旧版ChartCard */}
      <ChartCard
        title="日级趋势图"
        loading={loading}
        empty={!(trend as any)?.dates?.length}
        height={350}
        extra={
          <Space size="middle">
            <span className={styles.controlLabel}>指标:</span>
            <Segmented
              value={metric}
              onChange={(value) => setMetric(value as MetricType)}
              options={Object.entries(METRIC_LABELS).map(([key, label]) => ({ label, value: key }))}
            />
          </Space>
        }
      >
        <EChartsComponent option={echartsOption} height={320} />
      </ChartCard>

      {/* 数据表格 */}
      <Card
        className={styles.tableCard}
        title="平台×代理商聚合数据"
        extra={
          <Space>
            <span>代理商数量: <strong>{stats.agencyCount}</strong></span>
            <span style={{ margin: '0 8px', color: 'var(--color-text-disabled)' }}>|</span>
            <span>平台数量: <strong>{stats.platformCount}</strong></span>
            <span style={{ margin: '0 8px', color: 'var(--color-text-disabled)' }}>|</span>
            <Tooltip title="导出为CSV格式">
              <Button type="primary" icon={<DownloadOutlined />} onClick={exportToCSV} disabled={!sortedSummary || sortedSummary.length === 0}>
                导出CSV
              </Button>
            </Tooltip>
          </Space>
        }
      >
        <Spin spinning={loading}>
          <Table
            columns={columns}
            dataSource={sortedSummary}
            rowKey={(record) => `${record.platform}-${record.agency}-${record.business_model}`}
            loading={loading}
            scroll={{ x: 1400 }}
            pagination={false}
            rowClassName={(record) => {
              if (record.is_total) return styles.totalRow;
              if (record.is_subtotal) return styles.subtotalRow;
              return '';
            }}
          />
        </Spin>
      </Card>
    </div>
  );
};

export default AgencyAnalysisLegacyPage;