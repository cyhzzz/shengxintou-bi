/**
 * 数据概览页面
 * 展示核心指标、趋势图和平台分布
 */
import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Spin, message } from 'antd';
import {
  DollarOutlined,
  EyeOutlined,
  ClickOutlined,
  UserOutlined,
  TeamOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import { FilterBar, ChartCard, LineChart, PieChart } from '@/components';
import { dataService } from '@/services';
import type { SummaryData, TrendData } from '@/types';
import styles from './Dashboard.module.scss';

// 指标卡片颜色
const METRIC_COLORS = {
  cost: '#1890ff',
  impressions: '#52c41a',
  clicks: '#faad14',
  leads: '#f5222d',
  openedAccounts: '#722ed1',
  validCustomers: '#13c2c2',
};

const DashboardPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [trendData, setTrendData] = useState<TrendData | null>(null);

  // 加载数据
  const loadData = async (filters?: {
    startDate: string;
    endDate: string;
    platforms: string[];
    agencies: string[];
    businessModels: string[];
  }) => {
    setLoading(true);
    try {
      const filterParams = filters
        ? {
            start_date: filters.startDate,
            end_date: filters.endDate,
            platforms: filters.platforms,
            agencies: filters.agencies,
            business_models: filters.businessModels,
          }
        : undefined;

      // 并行加载汇总数据和趋势数据
      const [summaryRes, trendRes] = await Promise.all([
        dataService.getSummary(filterParams),
        dataService.getTrend(filterParams, ['cost', 'impressions', 'clicks', 'leads']),
      ]);

      if (summaryRes.success && summaryRes.data) {
        setSummaryData(summaryRes.data);
      }

      if (trendRes.success && trendRes.data) {
        setTrendData(trendRes.data);
      }
    } catch (error) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 初始加载
  useEffect(() => {
    loadData();
  }, []);

  // 筛选器查询
  const handleSearch = (filters: Parameters<typeof loadData>[0]) => {
    loadData(filters);
  };

  // 筛选器重置
  const handleReset = () => {
    loadData();
  };

  // 格式化数字
  const formatNumber = (value: number) => {
    if (value >= 10000) {
      return `${(value / 10000).toFixed(2)}万`;
    }
    return value.toLocaleString();
  };

  // 格式化金额
  const formatCurrency = (value: number) => {
    if (value >= 10000) {
      return `¥${(value / 10000).toFixed(2)}万`;
    }
    return `¥${value.toLocaleString()}`;
  };

  return (
    <div className={styles.dashboardPage}>
      <Spin spinning={loading}>
        {/* 筛选器 */}
        <FilterBar
          showPlatform
          showAgency
          onSearch={handleSearch}
          onReset={handleReset}
        />

        {/* 指标卡片 */}
        <Row gutter={[16, 16]} className={styles.metricsRow}>
          <Col xs={24} sm={12} md={8} lg={4}>
            <Card className={styles.metricCard}>
              <Statistic
                title="总花费"
                value={summaryData?.total_cost || 0}
                precision={2}
                prefix={<DollarOutlined style={{ color: METRIC_COLORS.cost }} />}
                suffix="元"
                formatter={(value) => formatCurrency(Number(value))}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8} lg={4}>
            <Card className={styles.metricCard}>
              <Statistic
                title="总曝光"
                value={summaryData?.total_impressions || 0}
                prefix={<EyeOutlined style={{ color: METRIC_COLORS.impressions }} />}
                formatter={(value) => formatNumber(Number(value))}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8} lg={4}>
            <Card className={styles.metricCard}>
              <Statistic
                title="总点击"
                value={summaryData?.total_clicks || 0}
                prefix={<ClickOutlined style={{ color: METRIC_COLORS.clicks }} />}
                formatter={(value) => formatNumber(Number(value))}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8} lg={4}>
            <Card className={styles.metricCard}>
              <Statistic
                title="总线索"
                value={summaryData?.total_leads || 0}
                prefix={<UserOutlined style={{ color: METRIC_COLORS.leads }} />}
                formatter={(value) => formatNumber(Number(value))}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8} lg={4}>
            <Card className={styles.metricCard}>
              <Statistic
                title="总开户"
                value={summaryData?.total_new_accounts || 0}
                prefix={<TeamOutlined style={{ color: METRIC_COLORS.openedAccounts }} />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8} lg={4}>
            <Card className={styles.metricCard}>
              <Statistic
                title="总有效户"
                value={summaryData?.total_valid_customers || 0}
                prefix={<TrophyOutlined style={{ color: METRIC_COLORS.validCustomers }} />}
              />
            </Card>
          </Col>
        </Row>

        {/* 图表区域 */}
        <Row gutter={[16, 16]} className={styles.chartsRow}>
          <Col xs={24} lg={16}>
            <ChartCard
              title="花费趋势"
              loading={loading}
              onRefresh={() => loadData()}
              height={350}
            >
              {trendData && (
                <LineChart
                  data={trendData.dates.flatMap((date, i) => [
                    {
                      date,
                      value: trendData.series[0]?.data[i] || 0,
                      category: '花费',
                    },
                  ])}
                  height={320}
                />
              )}
            </ChartCard>
          </Col>
          <Col xs={24} lg={8}>
            <ChartCard
              title="平台分布"
              loading={loading}
              onRefresh={() => loadData()}
              height={350}
            >
              {summaryData?.by_platform && (
                <PieChart
                  data={summaryData.by_platform.map((p) => ({
                    type: p.platform,
                    value: p.cost,
                  }))}
                  height={320}
                />
              )}
            </ChartCard>
          </Col>
        </Row>
      </Spin>
    </div>
  );
};

export default DashboardPage;