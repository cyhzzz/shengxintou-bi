/**
 * 厂商分析页面
 * 按代理商维度分析投放和转化数据
 * 完全对标旧版前端 AgencyAnalysisReport.js
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Table, Row, Col, Statistic, Segmented, Space, message, Tag } from 'antd';
import { DollarOutlined, EyeOutlined, UserOutlined, TeamOutlined, AimOutlined } from '@ant-design/icons';
import { FilterBar, ChartCard } from '@/components';
import { useFilterStore } from '@/stores';
import { getAgencyAnalysis } from '@/types/api';
import type { AgencyAnalysisResponse, TrendResponse } from '@/types/api.schemas';
import { Column } from '@ant-design/charts';
import styles from './index.module.scss';

// 指标类型 - 使用后端字段名
type MetricType = 'cost' | 'impressions' | 'clicks' | 'lead_users' | 'opened_account_users' | 'valid_customer_users';

// 指标标签映射 - 与旧版前端完全一致
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

// 平台颜色配置 - 与旧版一致
const PLATFORM_COLORS: Record<string, string> = {
  '腾讯': '#52c41a',
  '小红书': '#f5222d',
  '抖音': '#722ed1',
  '云极': '#D4A574',
  'YJ': '#D4A574',
  '高德': '#1890ff',
};

// 提取到组件外部，避免每次渲染重新创建
const getPlatformColor = (datum: any): string => {
  return PLATFORM_COLORS[datum.platform] || '#999';
};

// 展平后的数据类型
interface FlattenedSummaryItem {
  platform: string;
  business_model: string;
  agency: string;
  is_subtotal?: boolean;
  is_total?: boolean;
  // 基础指标
  cost: number;
  impressions: number;
  clicks: number;
  lead_users: number;
  opened_account_users: number;
  valid_customer_users: number;
  // 资产指标
  opened_account_assets: number;
  existing_customer_assets: number;
  // 计算指标
  lead_cost: number;
  account_cost: number;
}

const AgencyAnalysisPage: React.FC = () => {
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

      // 只有当有日期范围时才传递日期参数
      if (dateRange.startDate && dateRange.endDate) {
        params.start_date = dateRange.startDate;
        params.end_date = dateRange.endDate;
      }

      // 数组参数用逗号连接成字符串
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
        // 后端返回嵌套结构，展平为前端表格期望的结构
        const flattenedSummary = (response.data.summary || []).map((item: any) => {
          const m = item.metrics || {};
          return {
            platform: item.platform || '',
            business_model: item.business_model || '',
            agency: item.agency || '',
            is_subtotal: item.is_subtotal,
            is_total: item.is_total,
            // 基础指标
            cost: m.cost || 0,
            impressions: m.impressions || 0,
            clicks: m.clicks || 0,
            lead_users: m.lead_users || 0,
            opened_account_users: m.opened_account_users || 0,
            valid_customer_users: m.valid_customer_users || 0,
            // 资产指标
            opened_account_assets: m.opened_account_assets || 0,
            existing_customer_assets: m.existing_customer_assets || 0,
            // 计算指标
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

  // 初始加载 - 组件挂载时立即加载全量数据
  useEffect(() => {
    fetchData();
  }, []);

  // 处理筛选器查询
  const handleSearch = useCallback(() => {
    fetchData();
  }, [fetchData]);

  // 处理筛选器重置
  // 注意：这里必须显式传递空筛选参数，因为 resetAll() 更新 Zustand 后
  // fetchData 的闭包仍然持有旧的筛选值，直到下一次渲染
  const handleReset = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = {};

      // 重置时只传递日期范围，不传递其他筛选条件
      if (dateRange.startDate && dateRange.endDate) {
        params.start_date = dateRange.startDate;
        params.end_date = dateRange.endDate;
      }
      // 不传递 platforms, agencies, business_models - 相当于查询全量数据

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

  // 排序后的数据 - 与旧版 getSortedData 一致
  // 旧版排序：平台 → 业务模式 → 代理商
  // 小计行会因 agency='[小计]' 自然排在各平台数据末尾
  const sortedSummary = useMemo(() => {
    if (!summary || summary.length === 0) return [];

    return [...summary].sort((a, b) => {
      // 合计行始终在最后
      if (a.is_total) return 1;
      if (b.is_total) return -1;

      // 先按平台排序
      if (a.platform !== b.platform) {
        return a.platform.localeCompare(b.platform);
      }

      // 同平台内：小计行排在该平台数据末尾
      if (a.is_subtotal) return 1;
      if (b.is_subtotal) return -1;

      // 按业务模式排序
      if (a.business_model !== b.business_model) {
        return a.business_model.localeCompare(b.business_model);
      }

      // 按代理商排序（agency 为空时排在最后）
      if (!a.agency) return 1;
      if (!b.agency) return -1;
      return a.agency.localeCompare(b.agency);
    });
  }, [summary]);

  // 计算汇总数据 - 排除小计和合计行
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

  // 统计数据 - 代理商数量和平台数量
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
      render: (value: string, record: FlattenedSummaryItem) => {
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

  // 转换趋势数据 - 与旧版 renderChart 一致（堆叠柱状图）
  // 注意：后端返回 trend.dates 和 trend.series，不是 trend.data.dates
  const chartData = useMemo(() => {
    const dates = (trend as any)?.dates;
    const series = (trend as any)?.series;

    if (!dates?.length || !series?.length) {
      return [];
    }

    // 安全检查：限制数据量，防止内存溢出
    const MAX_SERIES = 50; // 最多50个系列
    const MAX_DATES = 90; // 最多90天数据

    // 限制日期数量
    const limitedDates = dates.length > MAX_DATES
      ? dates.slice(-MAX_DATES) // 取最近的数据
      : dates;

    // 按日期和平台+代理商+业务模式分组（与旧版完全一致）
    const groupedData: Record<string, {
      name: string;
      platform: string;
      data: { date: string; value: number }[];
    }> = {};

    // 限制系列数量
    const limitedSeries = series.length > MAX_SERIES
      ? series.slice(0, MAX_SERIES)
      : series;

    limitedSeries.forEach((record: any) => {
      const key = `${record.platform}_${record.agency || ''}_${record.business_model || ''}`;

      // 构建系列名称：只在有值时用"-"连接
      const nameParts = [record.platform];
      if (record.agency) nameParts.push(record.agency);
      if (record.business_model) nameParts.push(record.business_model);

      // 为未归因数据添加明确标识
      let displayName = nameParts.join('-');
      if (!record.agency && !record.business_model) {
        displayName = `${record.platform}-未归因`;
      } else if (!record.agency || !record.business_model) {
        displayName = `${displayName} (未归因)`;
      }

      if (!groupedData[key]) {
        groupedData[key] = {
          name: displayName,
          platform: record.platform,
          data: []
        };
      }
      groupedData[key].data.push({
        date: record.date,
        value: record.metrics?.[metric] || 0
      });
    });

    // 转换为 @ant-design/charts 堆叠柱状图需要的格式
    const result: { date: string; value: number; seriesName: string; platform: string }[] = [];
    const allDates = [...new Set(limitedDates as string[])].sort();

    Object.values(groupedData).forEach(group => {
      const dataMap = new Map(group.data.map(d => [d.date, d.value]));
      allDates.forEach(date => {
        result.push({
          date,
          value: dataMap.get(date) || 0,
          seriesName: group.name,
          platform: group.platform
        });
      });
    });

    return result;
  }, [trend, metric]);

  // 图表配置 - 堆叠柱状图（与旧版 ECharts 配置一致）
  // 使用 useMemo 优化，避免每次渲染重新创建配置对象
  const chartConfig = useMemo(() => {
    // 安全检查：如果数据为空或过大，返回空配置
    if (!chartData || chartData.length === 0) {
      return { data: [], xField: 'date', yField: 'value', colorField: 'seriesName' };
    }

    // 限制数据量，防止内存溢出
    const MAX_DATA_POINTS = 5000;
    const limitedData = chartData.length > MAX_DATA_POINTS
      ? chartData.slice(0, MAX_DATA_POINTS)
      : chartData;

    return {
      data: limitedData,
      xField: 'date',
      yField: 'value',
      colorField: 'seriesName',
      stack: true, // 启用堆叠
      group: false, // 禁用分组（堆叠模式）
      style: {
        // 使用组件外部定义的函数，避免每次渲染重新创建
        fill: getPlatformColor,
      },
      axis: {
        x: {
          labelAutoRotate: true,
          labelFormatter: (val: string) => val.substring(5), // 只显示 MM-DD
        },
        y: {
          labelFormatter: (val: number) => {
            if (val >= 10000) return `${(val / 10000).toFixed(1)}w`;
            return val.toLocaleString();
          },
        },
      },
      tooltip: {
        title: 'date',
        items: [
          { channel: 'y', field: 'value' },
        ],
      },
      legend: {
        position: 'top' as const,
        maxRow: 2,
      },
      interaction: {
        tooltip: {
          marker: false,
        },
      },
    };
  }, [chartData]);

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
            <Statistic
              title="总曝光"
              value={totals.impressions}
              prefix={<EyeOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card>
            <Statistic
              title="总点击"
              value={totals.clicks}
              prefix={<AimOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card>
            <Statistic
              title="线索人数"
              value={totals.leadUsers}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card>
            <Statistic
              title="开户人数"
              value={totals.openedAccounts}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card>
            <Statistic
              title="有效户人数"
              value={totals.validCustomers}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 趋势图 */}
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
              options={Object.entries(METRIC_LABELS).map(([key, label]) => ({
                label,
                value: key,
              }))}
            />
          </Space>
        }
      >
        <Column {...chartConfig} height={320} />
      </ChartCard>

      {/* 数据表格 */}
      <Card
        className={styles.tableCard}
        title="平台×代理商聚合数据"
        extra={
          <Space>
            <span>代理商数量: <strong>{stats.agencyCount}</strong></span>
            <span style={{ margin: '0 8px', color: '#d9d9d9' }}>|</span>
            <span>平台数量: <strong>{stats.platformCount}</strong></span>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={sortedSummary}
          rowKey={(record, index) => `${record.platform}-${record.agency}-${record.business_model}-${index}`}
          loading={loading}
          scroll={{ x: 1400 }}
          pagination={{
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
          rowClassName={(record) => {
            if (record.is_total) return styles.totalRow;
            if (record.is_subtotal) return styles.subtotalRow;
            return '';
          }}
        />
      </Card>
    </div>
  );
};

export default AgencyAnalysisPage;