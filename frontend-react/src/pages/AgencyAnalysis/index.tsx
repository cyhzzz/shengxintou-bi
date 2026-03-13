/**
 * 厂商分析页面
 * 按代理商维度分析投放和转化数据
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Row, Col, Statistic, Segmented, Space, message } from 'antd';
import { DollarOutlined, EyeOutlined, UserOutlined, TeamOutlined, AimOutlined } from '@ant-design/icons';
import { FilterBar, ChartCard, LineChart } from '@/components';
import { useFilterStore } from '@/stores';
import { getAgencyAnalysis } from '@/types/api';
import type { AgencyAnalysisItem, AgencyAnalysisResponse, TrendResponse } from '@/types/api.schemas';
import styles from './index.module.scss';

// 指标类型
type MetricType = 'cost' | 'impressions' | 'clicks' | 'leads' | 'opened_accounts';

// 指标标签映射
const METRIC_LABELS: Record<MetricType, string> = {
  cost: '花费',
  impressions: '曝光',
  clicks: '点击',
  leads: '线索',
  opened_accounts: '开户',
};

// 表格列配置
const getTableColumns = () => [
  {
    title: '平台',
    dataIndex: 'platform',
    key: 'platform',
    width: 80,
    fixed: 'left' as const,
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
  },
  {
    title: '花费',
    dataIndex: 'cost',
    key: 'cost',
    width: 120,
    align: 'right' as const,
    sorter: true,
    render: (value: number) => value ? `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}` : '-',
  },
  {
    title: '曝光',
    dataIndex: 'impressions',
    key: 'impressions',
    width: 100,
    align: 'right' as const,
    sorter: true,
    render: (value: number) => value?.toLocaleString() || '-',
  },
  {
    title: '点击',
    dataIndex: 'clicks',
    key: 'clicks',
    width: 80,
    align: 'right' as const,
    sorter: true,
    render: (value: number) => value?.toLocaleString() || '-',
  },
  {
    title: '线索',
    dataIndex: 'leads',
    key: 'leads',
    width: 80,
    align: 'right' as const,
    sorter: true,
    render: (value: number) => value?.toLocaleString() || '-',
  },
  {
    title: '开户',
    dataIndex: 'opened_accounts',
    key: 'opened_accounts',
    width: 80,
    align: 'right' as const,
    sorter: true,
    render: (value: number) => value?.toLocaleString() || '-',
  },
  {
    title: '有效户',
    dataIndex: 'valid_customers',
    key: 'valid_customers',
    width: 80,
    align: 'right' as const,
    sorter: true,
    render: (value: number) => value?.toLocaleString() || '-',
  },
];

const AgencyAnalysisPage: React.FC = () => {
  const [summary, setSummary] = useState<AgencyAnalysisItem[]>([]);
  const [trend, setTrend] = useState<TrendResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [metric, setMetric] = useState<MetricType>('cost');

  const { dateRange, selectedPlatforms, selectedAgencies, selectedBusinessModels } = useFilterStore();

  // 加载数据
  const fetchData = useCallback(async () => {
    if (!dateRange.startDate || !dateRange.endDate) {
      return;
    }

    setLoading(true);
    try {
      const params: Record<string, unknown> = {
        start_date: dateRange.startDate,
        end_date: dateRange.endDate,
      };

      if (selectedPlatforms.length > 0) {
        params.platforms = selectedPlatforms;
      }
      if (selectedAgencies.length > 0) {
        params.agencies = selectedAgencies;
      }
      if (selectedBusinessModels.length > 0) {
        params.business_models = selectedBusinessModels;
      }

      const response: AgencyAnalysisResponse = await getAgencyAnalysis(params);

      if (response.success && response.data) {
        setSummary(response.data.summary || []);
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
    if (dateRange.startDate && dateRange.endDate) {
      fetchData();
    }
  }, []); // 仅在组件挂载时执行一次

  // 处理筛选器查询
  const handleSearch = useCallback(() => {
    fetchData();
  }, [fetchData]);

  // 处理筛选器重置
  const handleReset = useCallback(() => {
    setSummary([]);
    setTrend(null);
  }, []);

  // 计算汇总数据
  const totalCost = summary.reduce((sum, item) => sum + (item.cost || 0), 0);
  const totalImpressions = summary.reduce((sum, item) => sum + (item.impressions || 0), 0);
  const totalClicks = summary.reduce((sum, item) => sum + (item.clicks || 0), 0);
  const totalLeads = summary.reduce((sum, item) => sum + (item.leads || 0), 0);
  const totalAccounts = summary.reduce((sum, item) => sum + (item.opened_accounts || 0), 0);
  const totalValidCustomers = summary.reduce((sum, item) => sum + (item.valid_customers || 0), 0);

  // 转换趋势数据
  const chartData = React.useMemo(() => {
    if (!trend?.data?.dates || !trend?.data?.values) {
      return [];
    }

    return trend.data.dates.map((date, index) => ({
      date,
      value: trend.data?.values?.[index] || 0,
      category: METRIC_LABELS[metric],
    }));
  }, [trend, metric]);

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
        <Col xs={12} sm={8} md={4}>
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
        <Col xs={12} sm={8} md={4}>
          <Card>
            <Statistic
              title="总曝光"
              value={totalImpressions}
              prefix={<EyeOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card>
            <Statistic
              title="总点击"
              value={totalClicks}
              prefix={<AimOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card>
            <Statistic
              title="总线索"
              value={totalLeads}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card>
            <Statistic
              title="总开户"
              value={totalAccounts}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
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
      <ChartCard
        title="趋势分析"
        loading={loading}
        empty={!trend?.data?.dates?.length}
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
        <LineChart data={chartData} height={320} />
      </ChartCard>

      {/* 数据表格 */}
      <Card className={styles.tableCard} title="代理商数据">
        <Table
          columns={columns}
          dataSource={summary}
          rowKey={(record) => `${record.platform}-${record.agency}-${record.business_model}`}
          loading={loading}
          scroll={{ x: 1000 }}
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
                  <strong>{totalImpressions.toLocaleString()}</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={5} align="right">
                  <strong>{totalClicks.toLocaleString()}</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={6} align="right">
                  <strong>{totalLeads.toLocaleString()}</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={7} align="right">
                  <strong>{totalAccounts.toLocaleString()}</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={8} align="right">
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