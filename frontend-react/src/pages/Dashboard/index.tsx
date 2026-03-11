/**
 * 数据概览页面
 * 展示核心指标、趋势图和平台分布
 * 使用 /dashboard/core-metrics 和 /dashboard/trend-data 接口（与原始前端一致）
 */
import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Spin, message, Tooltip } from 'antd';
import {
  DollarOutlined,
  EyeOutlined,
  AimOutlined,
  UserOutlined,
  TeamOutlined,
  TrophyOutlined,
  RiseOutlined,
  FallOutlined,
  AccountBookOutlined,
  GoldOutlined,
} from '@ant-design/icons';
import { FilterBar, ChartCard, LineChart, PieChart } from '@/components';
import { dataService } from '@/services';
import type { CoreMetrics, WowChanges, DashboardTrendData } from '@/types';
import styles from './Dashboard.module.scss';

// 指标卡片颜色
const METRIC_COLORS = {
  cost: '#1890ff',
  impressions: '#52c41a',
  clicks: '#faad14',
  leads: '#f5222d',
  openedAccounts: '#722ed1',
  validCustomers: '#13c2c2',
  customerAssets: '#fa8c16',
  existingAssets: '#eb2f96',
};

const DashboardPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [coreMetrics, setCoreMetrics] = useState<CoreMetrics | null>(null);
  const [wowChanges, setWowChanges] = useState<WowChanges | null>(null);
  const [trendData, setTrendData] = useState<DashboardTrendData | null>(null);
  const [dateRange, setDateRange] = useState<{ start_date: string; end_date: string } | null>(null);

  // 获取默认日期范围（近30天）
  const getDefaultDateRange = () => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 30 + 1);

    const formatDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    return {
      start_date: formatDate(startDate),
      end_date: formatDate(endDate),
    };
  };

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
      // 构建请求参数
      const params = filters
        ? {
            start_date: filters.startDate,
            end_date: filters.endDate,
            platforms: filters.platforms,
            agencies: filters.agencies,
            business_models: filters.businessModels,
          }
        : {
            ...getDefaultDateRange(),
          };

      // 保存日期范围用于趋势数据
      setDateRange({ start_date: params.start_date, end_date: params.end_date });

      // 并行加载核心指标数据
      const [coreMetricsRes] = await Promise.all([
        dataService.getDashboardCoreMetrics(params),
      ]);

      if (coreMetricsRes.success && coreMetricsRes.data) {
        setCoreMetrics(coreMetricsRes.data.core_metrics);
        setWowChanges(coreMetricsRes.data.wow_changes);
      }

      // 加载趋势数据
      if (params.start_date && params.end_date) {
        const trendRes = await dataService.getDashboardTrendData({
          start_date: params.start_date,
          end_date: params.end_date,
          platforms: params.platforms,
          agencies: params.agencies,
          business_models: params.business_models,
          metric_type: 'cost_per_lead',
        });

        if (trendRes.success && trendRes.data) {
          setTrendData(trendRes.data);
        }
      }
    } catch (error) {
      message.error('加载数据失败');
      console.error('[Dashboard] 数据加载失败:', error);
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

  // 渲染环比变化
  const renderWowChange = (wow?: { value: number; trend: string; color: string }) => {
    if (!wow) return null;
    const icon = wow.trend === 'up' ? <RiseOutlined /> : <FallOutlined />;
    const color = wow.color === 'green' ? '#52c41a' : '#f5222d';
    return (
      <span style={{ color, marginLeft: 8, fontSize: 12 }}>
        {icon} {wow.value}%
      </span>
    );
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

        {/* 投入效果指标卡片 */}
        <div className={styles.sectionTitle}>投入效果</div>
        <Row gutter={[16, 16]} className={styles.metricsRow}>
          <Col xs={24} sm={12} md={8} lg={4}>
            <Card className={styles.metricCard}>
              <Statistic
                title="总花费"
                value={coreMetrics?.investment || 0}
                precision={2}
                prefix={<DollarOutlined style={{ color: METRIC_COLORS.cost }} />}
                suffix="元"
                formatter={(value) => formatCurrency(Number(value))}
              />
              <div className={styles.wowChange}>
                {renderWowChange(wowChanges?.investment)}
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8} lg={4}>
            <Card className={styles.metricCard}>
              <Statistic
                title="总曝光"
                value={coreMetrics?.total_impressions || 0}
                prefix={<EyeOutlined style={{ color: METRIC_COLORS.impressions }} />}
                formatter={(value) => formatNumber(Number(value))}
              />
              <div className={styles.wowChange}>
                {renderWowChange(wowChanges?.total_impressions)}
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8} lg={4}>
            <Card className={styles.metricCard}>
              <Statistic
                title="总点击"
                value={coreMetrics?.total_clicks || 0}
                prefix={<AimOutlined style={{ color: METRIC_COLORS.clicks }} />}
                formatter={(value) => formatNumber(Number(value))}
              />
              <div className={styles.wowChange}>
                {renderWowChange(wowChanges?.total_clicks)}
              </div>
            </Card>
          </Col>
        </Row>

        {/* 业务成果指标卡片 */}
        <div className={styles.sectionTitle}>业务成果</div>
        <Row gutter={[16, 16]} className={styles.metricsRow}>
          <Col xs={24} sm={12} md={8} lg={4}>
            <Card className={styles.metricCard}>
              <Statistic
                title="总线索"
                value={coreMetrics?.total_leads || 0}
                prefix={<UserOutlined style={{ color: METRIC_COLORS.leads }} />}
                formatter={(value) => formatNumber(Number(value))}
              />
              <div className={styles.wowChange}>
                {renderWowChange(wowChanges?.total_leads)}
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8} lg={4}>
            <Card className={styles.metricCard}>
              <Statistic
                title="新开客户"
                value={coreMetrics?.new_customers || 0}
                prefix={<TeamOutlined style={{ color: METRIC_COLORS.openedAccounts }} />}
              />
              <div className={styles.wowChange}>
                {renderWowChange(wowChanges?.new_customers)}
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8} lg={4}>
            <Card className={styles.metricCard}>
              <Statistic
                title="新有效户"
                value={coreMetrics?.new_valid_accounts || 0}
                prefix={<TrophyOutlined style={{ color: METRIC_COLORS.validCustomers }} />}
              />
              <div className={styles.wowChange}>
                {renderWowChange(wowChanges?.new_valid_accounts)}
              </div>
            </Card>
          </Col>
        </Row>

        {/* 客户资产指标卡片 */}
        <div className={styles.sectionTitle}>客户资产</div>
        <Row gutter={[16, 16]} className={styles.metricsRow}>
          <Col xs={24} sm={12} md={8} lg={4}>
            <Card className={styles.metricCard}>
              <Statistic
                title={
                  <Tooltip title="新开客户的资产总额">
                    <span>新客户资产</span>
                  </Tooltip>
                }
                value={coreMetrics?.customer_assets || 0}
                precision={2}
                prefix={<AccountBookOutlined style={{ color: METRIC_COLORS.customerAssets }} />}
                formatter={(value) => formatCurrency(Number(value))}
              />
              <div className={styles.wowChange}>
                {renderWowChange(wowChanges?.customer_assets)}
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8} lg={4}>
            <Card className={styles.metricCard}>
              <Statistic
                title={
                  <Tooltip title="服务存量客户的资产总额">
                    <span>存量客户资产</span>
                  </Tooltip>
                }
                value={coreMetrics?.existing_customers_assets || 0}
                precision={2}
                prefix={<GoldOutlined style={{ color: METRIC_COLORS.existingAssets }} />}
                formatter={(value) => formatCurrency(Number(value))}
              />
              <div className={styles.wowChange}>
                {renderWowChange(wowChanges?.existing_customers_assets)}
              </div>
            </Card>
          </Col>
        </Row>

        {/* 效率指标 */}
        <div className={styles.sectionTitle}>效率指标</div>
        <Row gutter={[16, 16]} className={styles.metricsRow}>
          <Col xs={24} sm={12} md={8} lg={4}>
            <Card className={styles.metricCard}>
              <Statistic
                title="线索成本"
                value={coreMetrics?.cost_per_lead || 0}
                precision={2}
                prefix="¥"
                suffix="/条"
              />
              <div className={styles.wowChange}>
                {renderWowChange(wowChanges?.cost_per_lead)}
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8} lg={4}>
            <Card className={styles.metricCard}>
              <Statistic
                title="有效户成本"
                value={coreMetrics?.cost_per_valid_account || 0}
                precision={2}
                prefix="¥"
                suffix="/户"
              />
              <div className={styles.wowChange}>
                {renderWowChange(wowChanges?.cost_per_valid_account)}
              </div>
            </Card>
          </Col>
        </Row>

        {/* 图表区域 */}
        <Row gutter={[16, 16]} className={styles.chartsRow}>
          <Col xs={24} lg={24}>
            <ChartCard
              title="线索成本趋势"
              loading={loading}
              onRefresh={() => dateRange && loadData({
                startDate: dateRange.start_date,
                endDate: dateRange.end_date,
                platforms: [],
                agencies: [],
                businessModels: [],
              })}
              height={350}
            >
              {trendData && trendData.trend_data.length > 0 && (
                <LineChart
                  data={trendData.trend_data.map((item) => ({
                    date: item.date,
                    value: item.value,
                    category: '线索成本',
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