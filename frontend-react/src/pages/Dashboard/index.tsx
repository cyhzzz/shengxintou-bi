/**
 * 数据概览页面
 * 展示核心指标、趋势图和业务分组
 * 使用自动生成的 API 类型和自定义 Hooks
 *
 * 业务分组结构：
 * - 前端投放: 阶段投入金额、总展示数、总点击数、总线索数
 * - 后端转化: 新开客户数、新增有效户数、客户资产、客户贡献、存量客户资产
 * - 运营效率: 单线索成本、单开户成本、单有效户成本
 */
import React, { useEffect, useCallback, useState } from 'react';
import { Row, Col, Spin, Tooltip, Typography, message } from 'antd';
import {
  DollarOutlined,
  EyeOutlined,
  AimOutlined,
  UserOutlined,
  TeamOutlined,
  TrophyOutlined,
  AccountBookOutlined,
  GoldOutlined,
  RiseOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { FilterBar } from '@/components';
import { MetricCard, MetricSection } from '@/components/MetricCard';
import TrendChart, { type MetricType } from './components/TrendChart';
import CalendarHeatmap from './components/CalendarHeatmap';
import { dataServiceOmniChannel } from '@/services/dataService';
import {
  useCoreMetrics,
  useTrendData,
  useDashboardFilters,
} from './hooks';
import type { PostDashboardCoreMetricsBody, PostDashboardTrendDataBody } from '@/types/api.schemas';
import styles from './Dashboard.module.scss';

const { Text } = Typography;

// 指标卡片颜色 — 与 tokens.css 中 --chart-color-1 ~ --chart-color-8 对齐
const METRIC_COLORS = {
  cost: 'var(--chart-color-1)',
  impressions: 'var(--chart-color-2)',
  clicks: 'var(--chart-color-3)',
  leads: 'var(--chart-color-4)',
  openedAccounts: 'var(--chart-color-5)',
  validCustomers: 'var(--chart-color-6)',
  customerAssets: 'var(--chart-color-7)',
  existingAssets: 'var(--chart-color-8)',
  contribution: 'var(--chart-color-5)',
};

const DashboardPage: React.FC = () => {
  // 趋势图指标类型状态
  const [trendMetricType, setTrendMetricType] = useState<MetricType>('cost_per_lead');
  // 趋势图粒度状态
  const [trendGranularity, setTrendGranularity] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  // 使用自定义 Hooks
  const {
    filters,
    updateFilters,
    resetFilters,
    getDefaultDateRange,
  } = useDashboardFilters();

  const {
    coreMetrics,
    wowChanges: rawWowChanges,
    loading: coreMetricsLoading,
    fetchCoreMetrics,
  } = useCoreMetrics();

  // "全部"日期范围（2020-01-01 起）无对比周期，环比 0.00% 会误导用户，此时不展示环比
  const isAllTimeRange = filters.start_date === '2020-01-01';
  const wowChanges = isAllTimeRange ? null : rawWowChanges;

  const {
    trendData,
    loading: trendLoading,
    fetchTrendData,
  } = useTrendData();

  // 开户日历热力图：过去 365 天 互联网渠道每日开户数
  const [calendarData, setCalendarData] = useState<{ date: string; value: number }[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  useEffect(() => {
    let alive = true;
    setCalendarLoading(true);
    dataServiceOmniChannel
      .getOmniChannelDailyCalendar({ days: 365 })
      .then((resp: any) => {
        if (!alive) return;
        const rows = Array.isArray(resp?.data) ? resp.data : (Array.isArray(resp) ? resp : []);
        setCalendarData(rows.map((r: any) => ({ date: r.date, value: Number(r.opens ?? r.value ?? 0) })));
      })
      .catch((err) => { if (alive) { setCalendarData([]); message.warning('开户日历热力图加载失败，已使用空数据兜底'); console.error('[Dashboard] daily-calendar load failed:', err); } })
      .finally(() => { if (alive) setCalendarLoading(false); });
    return () => { alive = false; };
  }, []);

  // 合并加载状态
  const loading = coreMetricsLoading || trendLoading;

  // 加载数据
  const loadData = useCallback(async (overrideFilters?: Partial<typeof filters>) => {
    const activeFilters = overrideFilters ? { ...filters, ...overrideFilters } : filters;

    const params: PostDashboardCoreMetricsBody = {
      start_date: activeFilters.start_date,
      end_date: activeFilters.end_date,
    };

    // 添加可选筛选条件
    if (activeFilters.platforms.length > 0) {
      params.platforms = activeFilters.platforms as PostDashboardCoreMetricsBody['platforms'];
    }
    if (activeFilters.agencies.length > 0) {
      params.agencies = activeFilters.agencies;
    }
    if (activeFilters.business_models.length > 0) {
      params.business_models = activeFilters.business_models as PostDashboardCoreMetricsBody['business_models'];
    }

    // 并行加载数据
    await Promise.all([
      fetchCoreMetrics(params),
      fetchTrendData({
        ...params,
        metric_type: trendMetricType as PostDashboardTrendDataBody['metric_type'],
        granularity: trendGranularity,
      } as PostDashboardTrendDataBody),
    ]);
  }, [filters, fetchCoreMetrics, fetchTrendData, trendMetricType, trendGranularity]);

  // 初始加载
  useEffect(() => {
    loadData();
  }, []); // 只在组件挂载时加载一次

  // 筛选器查询
  const handleSearch = useCallback((searchFilters: {
    startDate: string;
    endDate: string;
    platforms: string[];
    agencies: string[];
    businessModels: string[];
  }) => {
    const newFilters = {
      start_date: searchFilters.startDate,
      end_date: searchFilters.endDate,
      platforms: searchFilters.platforms,
      agencies: searchFilters.agencies,
      business_models: searchFilters.businessModels,
    };

    // 更新状态
    updateFilters(newFilters);

    // 直接使用新筛选条件加载数据，不依赖状态更新
    loadData(newFilters);
  }, [updateFilters, loadData]);

  // 筛选器重置
  const handleReset = useCallback(() => {
    resetFilters();
    // 使用默认筛选条件加载数据
    const defaultRange = {
      start_date: getDefaultDateRange().start_date,
      end_date: getDefaultDateRange().end_date,
      platforms: [],
      agencies: [],
      business_models: [],
    };
    loadData(defaultRange);
  }, [resetFilters, loadData]);

  // 趋势图指标类型变化
  const handleTrendMetricChange = useCallback((metricType: MetricType) => {
    setTrendMetricType(metricType);
    // 重新加载趋势数据
    const params: PostDashboardTrendDataBody & { granularity: 'daily' | 'weekly' | 'monthly' } = {
      start_date: filters.start_date,
      end_date: filters.end_date,
      metric_type: metricType as PostDashboardTrendDataBody['metric_type'],
      granularity: trendGranularity,
    };
    if (filters.platforms.length > 0) {
      params.platforms = filters.platforms as PostDashboardTrendDataBody['platforms'];
    }
    if (filters.agencies.length > 0) {
      params.agencies = filters.agencies;
    }
    if (filters.business_models.length > 0) {
      params.business_models = filters.business_models as PostDashboardTrendDataBody['business_models'];
    }
    fetchTrendData(params);
  }, [filters, fetchTrendData, trendGranularity]);

  // 趋势图粒度变化
  const handleTrendGranularityChange = useCallback((granularity: 'daily' | 'weekly' | 'monthly') => {
    setTrendGranularity(granularity);
    // 重新加载趋势数据
    const params: PostDashboardTrendDataBody & { granularity: 'daily' | 'weekly' | 'monthly' } = {
      start_date: filters.start_date,
      end_date: filters.end_date,
      metric_type: trendMetricType as PostDashboardTrendDataBody['metric_type'],
      granularity,
    };
    if (filters.platforms.length > 0) {
      params.platforms = filters.platforms as PostDashboardTrendDataBody['platforms'];
    }
    if (filters.agencies.length > 0) {
      params.agencies = filters.agencies;
    }
    if (filters.business_models.length > 0) {
      params.business_models = filters.business_models as PostDashboardTrendDataBody['business_models'];
    }
    fetchTrendData(params);
  }, [filters, fetchTrendData, trendMetricType]);

  // 计算单开户成本
  const costPerAccount = coreMetrics?.investment && coreMetrics?.new_customers
    ? coreMetrics.investment / coreMetrics.new_customers
    : 0;

  return (
    <div className={styles.dashboardPage}>
      <Spin spinning={loading}>
        {/* 筛选器 */}
        <FilterBar
          showPlatform
          showAgency
          showBusinessModel
          onSearch={handleSearch}
          onReset={handleReset}
        />

{/* 前端投放指标卡片 */}
        <MetricSection
          title={
            <>
              <AimOutlined style={{ color: 'var(--color-brand)' }} /> <Text type="secondary">前端投放</Text>
            </>
          }
          description="广告投放与获取效果"
        >

                          <MetricCard
                title="阶段投入金额"
                value={coreMetrics?.investment}
                wowChange={wowChanges?.investment ? {
                  value: wowChanges.investment.value,
                  trend: wowChanges.investment.trend,
                  color: wowChanges.investment.color,
                } : undefined}
                prefix="¥"
                formatter="currency"
                icon={<DollarOutlined style={{ color: METRIC_COLORS.cost }} />}
              />
                          <MetricCard
                title="总展示数"
                value={coreMetrics?.total_impressions}
                wowChange={wowChanges?.total_impressions ? {
                  value: wowChanges.total_impressions.value,
                  trend: wowChanges.total_impressions.trend,
                  color: wowChanges.total_impressions.color,
                } : undefined}
                formatter="number"
                icon={<EyeOutlined style={{ color: METRIC_COLORS.impressions }} />}
              />
                          <MetricCard
                title="总点击数"
                value={coreMetrics?.total_clicks}
                wowChange={wowChanges?.total_clicks ? {
                  value: wowChanges.total_clicks.value,
                  trend: wowChanges.total_clicks.trend,
                  color: wowChanges.total_clicks.color,
                } : undefined}
                formatter="number"
                icon={<AimOutlined style={{ color: METRIC_COLORS.clicks }} />}
              />
                          <MetricCard
                title="总线索数"
                value={coreMetrics?.total_leads}
                wowChange={wowChanges?.total_leads ? {
                  value: wowChanges.total_leads.value,
                  trend: wowChanges.total_leads.trend,
                  color: wowChanges.total_leads.color,
                } : undefined}
                formatter="number"
                icon={<UserOutlined style={{ color: METRIC_COLORS.leads }} />}
              />
        </MetricSection>

        {/* 后端转化指标卡片 */}
        <MetricSection
          title={
            <>
              <TrophyOutlined style={{ color: 'var(--color-success)' }} /> <Text type="secondary">后端转化</Text>
            </>
          }
          description="客户获取与价值创造"
        >
              <MetricCard
                title="新开客户数"
                value={coreMetrics?.new_customers}
                wowChange={wowChanges?.new_customers ? {
                  value: wowChanges.new_customers.value,
                  trend: wowChanges.new_customers.trend,
                  color: wowChanges.new_customers.color,
                } : undefined}
                formatter="number"
                icon={<TeamOutlined style={{ color: METRIC_COLORS.openedAccounts }} />}
              />
              <MetricCard
                title="新增有效户数"
                value={coreMetrics?.new_valid_accounts}
                wowChange={wowChanges?.new_valid_accounts ? {
                  value: wowChanges.new_valid_accounts.value,
                  trend: wowChanges.new_valid_accounts.trend,
                  color: wowChanges.new_valid_accounts.color,
                } : undefined}
                formatter="number"
                icon={<TrophyOutlined style={{ color: METRIC_COLORS.validCustomers }} />}
              />
              <MetricCard
                title={
                  <Tooltip title="新开客户的资产总额">
                    <span>客户资产</span>
                  </Tooltip>
                }
                value={coreMetrics?.customer_assets}
                wowChange={wowChanges?.customer_assets ? {
                  value: wowChanges.customer_assets.value,
                  trend: wowChanges.customer_assets.trend,
                  color: wowChanges.customer_assets.color,
                } : undefined}
                prefix="¥"
                formatter="currency"
                icon={<AccountBookOutlined style={{ color: METRIC_COLORS.customerAssets }} />}
              />
              <MetricCard
                title={
                  <Tooltip title="客户今年创收金额">
                    <span>客户贡献</span>
                  </Tooltip>
                }
                value={coreMetrics?.customer_contribution}
                wowChange={wowChanges?.customer_contribution ? {
                  value: wowChanges.customer_contribution.value,
                  trend: wowChanges.customer_contribution.trend,
                  color: wowChanges.customer_contribution.color,
                } : undefined}
                prefix="¥"
                formatter="currency"
                icon={<RiseOutlined style={{ color: METRIC_COLORS.contribution }} />}
              />
              <MetricCard
                title={
                  <Tooltip title="服务存量客户的资产总额">
                    <span>存量客户资产</span>
                  </Tooltip>
                }
                value={coreMetrics?.existing_customers_assets}
                wowChange={wowChanges?.existing_customers_assets ? {
                  value: wowChanges.existing_customers_assets.value,
                  trend: wowChanges.existing_customers_assets.trend,
                  color: wowChanges.existing_customers_assets.color,
                } : undefined}
                prefix="¥"
                formatter="currency"
                icon={<GoldOutlined style={{ color: METRIC_COLORS.existingAssets }} />}
              />
        </MetricSection>

        {/* 运营效率指标卡片 */}
        <MetricSection
          title={
            <>
              <ThunderboltOutlined style={{ color: 'var(--color-warning)' }} /> <Text type="secondary">运营效率</Text>
            </>
          }
          description="单位成本分析"
        >

                          <MetricCard
                title="单线索成本"
                value={coreMetrics?.cost_per_lead}
                wowChange={wowChanges?.cost_per_lead ? {
                  value: wowChanges.cost_per_lead.value,
                  trend: wowChanges.cost_per_lead.trend,
                  color: wowChanges.cost_per_lead.color,
                } : undefined}
                prefix="¥"
                formatter="currency"
                inverseTrend
                icon={<ThunderboltOutlined style={{ color: METRIC_COLORS.cost }} />}
              />
                          <MetricCard
                title="单开户成本"
                value={costPerAccount}
                wowChange={wowChanges?.cost_per_account ? {
                  value: wowChanges.cost_per_account.value,
                  trend: wowChanges.cost_per_account.trend,
                  color: wowChanges.cost_per_account.color,
                } : undefined}
                prefix="¥"
                formatter="currency"
                inverseTrend
                icon={<DollarOutlined style={{ color: METRIC_COLORS.cost }} />}
              />
                          <MetricCard
                title="单有效户成本"
                value={coreMetrics?.cost_per_valid_account}
                wowChange={wowChanges?.cost_per_valid_account ? {
                  value: wowChanges.cost_per_valid_account.value,
                  trend: wowChanges.cost_per_valid_account.trend,
                  color: wowChanges.cost_per_valid_account.color,
                } : undefined}
                prefix="¥"
                formatter="currency"
                inverseTrend
                icon={<DollarOutlined style={{ color: METRIC_COLORS.cost }} />}
              />
        </MetricSection>

        {/* 趋势图 */}
        <Row gutter={[16, 16]} className={styles.chartsRow}>
          <Col xs={24} lg={24}>
            <TrendChart
              data={trendData?.trend_data || []}
              metricType={trendMetricType}
              loading={trendLoading}
              height={350}
              onMetricTypeChange={handleTrendMetricChange}
              onGranularityChange={handleTrendGranularityChange}
            />
          </Col>
        </Row>

        {/* 互联网渠道开户日历热力图（7 行 × N 列布局，表头与 Dashboard 其他卡组一致） */}
        <MetricSection
          title={
            <>
              🔥 <Text type="secondary">开户日历热力图</Text>
            </>
          }
          description="过去一年每日互联网引流开户密度（蓝色越深 = 当日开户数越多）"
        >
          <CalendarHeatmap data={calendarData} loading={calendarLoading} />
        </MetricSection>
      </Spin>
    </div>
  );
};

export default DashboardPage;
