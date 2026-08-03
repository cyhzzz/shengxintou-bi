/**
 * 厂商分析页面 (v3.1) - ECharts 直接渲染趋势图，不依赖旧版 JS
 *
 * 数据源: agg_vendor_daily
 * 端点: GET /api/v1/agency-analysis
 * 维度: 平台 / 业务模式 / 厂商
 *
 * Bug 2 修复: 之前用 useLegacyReport('AgencyAnalysisReport') 等待旧版 JS 加载，
 * 但旧版 JS 路径已废弃，导致 <div id="trendChart"> 容器一直空白。
 * 现改用 ECharts 直接渲染后端 trend 数据。
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, Segmented, Space, Button, Tooltip, Spin, Table, Tag, Typography } from 'antd';
import { DollarOutlined, EyeOutlined, UserOutlined, TeamOutlined, AimOutlined, DownloadOutlined, ThunderboltOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { EChartsOption } from 'echarts';
import { FilterBar, FadeInSection } from '@/components';
import { MetricCard, MetricSection } from '@/components/MetricCard';
import { ReportFooter } from '@/components/ReportFooter';
import EChartsComponent from '@/components/Chart/ECharts';
import { useFilterStore } from '@/stores';
import { http } from '@/services/http';
import { pickEChartsColor } from '@/utils/echartsColors';
import {
  CHANNEL_CATEGORY_MAP,
  sortChannelsByCategory,
  buildChannelColorMap,
} from '@/utils/channelColors';
import styles from './index.module.scss';

const { Text } = Typography;

type MetricType = 'cost' | 'impressions' | 'clicks' | 'lead_users' | 'app_activation_users' | 'opened_account_users' | 'valid_customer_users';

const METRIC_LABELS: Record<MetricType, string> = {
  cost: '花费',
  impressions: '曝光',
  clicks: '点击',
  lead_users: '线索',
  // APP激活业务含义近似线索（前端回传激活），故紧贴线索后、开户前
  app_activation_users: 'APP激活',
  opened_account_users: '开户',
  valid_customer_users: '有效户',
};


interface FlattenedSummaryItem {
  platform: string;
  business_model: string;
  agency: string;
  agency_short?: string;
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
  // v3.7.1：APP 下载链路指标
  app_activation_users?: number;
  app_activation_cost?: number;
}

interface TrendSeriesItem {
  date: string;
  platform: string;
  business_model: string;
  agency: string;
  metrics: {
    cost: number;
    impressions: number;
    clicks: number;
    lead_users: number;
    opened_account_users: number;
    valid_customer_users: number;
    app_activation_users?: number;
  };
}

const AgencyAnalysisPage: React.FC = () => {
  const [summary, setSummary] = useState<FlattenedSummaryItem[]>([]);
  const [trend, setTrend] = useState<{ dates: string[]; series: TrendSeriesItem[] }>({ dates: [], series: [] });
  const [stats, setStats] = useState<{ agency_count: number; platform_count: number }>({ agency_count: 0, platform_count: 0 });
  const [loading, setLoading] = useState(false);
  const [metric, setMetric] = useState<MetricType>('cost');

  const {
    dateRange,
    selectedPlatforms,
    selectedAgencies,
    selectedBusinessModels,
  } = useFilterStore();

  const buildParams = useCallback(() => {
    const params: Record<string, string> = {};
    if (dateRange.startDate && dateRange.endDate) {
      params.start_date = dateRange.startDate;
      params.end_date = dateRange.endDate;
    }
    if (selectedPlatforms.length > 0) params.platforms = selectedPlatforms.join(',');
    if (selectedAgencies.length > 0) params.agencies = selectedAgencies.join(',');
    if (selectedBusinessModels.length > 0) params.business_models = selectedBusinessModels.join(',');
    return params;
  }, [dateRange, selectedPlatforms, selectedAgencies, selectedBusinessModels]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = buildParams();
      const res: any = await http.get('/agency-analysis', params);
      if (res?.success && res.data) {
        const flattened: FlattenedSummaryItem[] = (res.data.summary || []).map((item: any) => {
          const m = item.metrics || {};
          return {
            platform: item.platform || '',
            business_model: item.business_model || '',
            agency: item.agency || '',
            agency_short: item.agency_short || item.agency || '',
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
            app_activation_users: m.app_activation_users || 0,
            app_activation_cost: m.app_activation_cost || 0,
          };
        });
        setSummary(flattened);
        setTrend(res.data.trend || { dates: [], series: [] });
        setStats(res.data.meta || { agency_count: 0, platform_count: 0 });
      }
    } catch (err) {
      console.error('[AgencyAnalysis] fetch error', err);
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totals = useMemo(() => {
    const t = { cost: 0, impressions: 0, clicks: 0, lead_users: 0, app_activation: 0, opened: 0, valid: 0 };
    summary.forEach((item) => {
      if (item.is_total) {
        t.cost = item.cost;
        t.impressions = item.impressions;
        t.clicks = item.clicks;
        t.lead_users = item.lead_users;
        t.app_activation = item.app_activation_users || 0;
        t.opened = item.opened_account_users;
        t.valid = item.valid_customer_users;
      }
    });
    return t;
  }, [summary]);

  const visibleSummary = useMemo(() => {
    const detailCounts = new Map<string, number>();
    summary.forEach((item) => {
      if (!item.is_subtotal && !item.is_total) {
        const key = `${item.platform}|||${item.business_model}`;
        detailCounts.set(key, (detailCounts.get(key) || 0) + 1);
      }
    });
    return summary.filter((item) => {
      // 直播业务不进入厂商分析表，已在 直播获客 菜单的 直播漏斗/主播聚类 中独立查看
      if (item.business_model === '直播' && !item.is_total) return false;
      if (item.is_total) return true;
      if (item.is_subtotal) {
        const key = `${item.platform}|||${item.business_model}`;
        return (detailCounts.get(key) || 0) > 1;
      }
      return true;
    });
  }, [summary]);

  const trendOption = useMemo((): EChartsOption => {
    if (!trend.dates.length || !trend.series.length) {
      return {
        title: { text: '暂无趋势数据', left: 'center', top: 'middle', textStyle: { color: '#999', fontSize: 14 } },
      };
    }
    const metricKey = metric as keyof TrendSeriesItem['metrics'];
    const byPlatform = new Map<string, Map<string, number>>();
    trend.dates.forEach((d) => byPlatform.set(d, new Map()));
    trend.series.forEach((s) => {
      const dayMap = byPlatform.get(s.date);
      if (!dayMap) return;
      const val = Number(s.metrics?.[metricKey] || 0);
      const prev = dayMap.get(s.platform) || 0;
      dayMap.set(s.platform, prev + val);
    });
    const platforms = Array.from(new Set(trend.series.map((s) => s.platform))).filter(Boolean);
    // 堆叠柱状图（按平台分色堆叠，按日期累加）
    // v3.5.4：参照报告生成的同色系策略 —— 同大类平台使用同色系深浅，
    //          避免随平台增多颜色杂乱；堆叠顺序按大类聚合（应用市场 → 内容平台 → 本地生活）
    const sortedPlatforms = sortChannelsByCategory(platforms, CHANNEL_CATEGORY_MAP);
    const platformColorMap = buildChannelColorMap(sortedPlatforms);
    const seriesData = sortedPlatforms.map((p) => ({
      name: p,
      type: 'bar' as const,
      stack: '总量',
      barMaxWidth: 36,
      itemStyle: { color: platformColorMap[p] || pickEChartsColor(sortedPlatforms.indexOf(p)) },
      emphasis: { focus: 'series' as const },
      data: trend.dates.map((d) => byPlatform.get(d)?.get(p) || 0),
    }));
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross', label: { backgroundColor: '#6a7985' } },
        valueFormatter: (v: any) => Number(v || 0).toLocaleString(),
      },
      legend: { data: sortedPlatforms, bottom: 0, type: 'scroll' },
      grid: { left: '3%', right: '4%', bottom: '15%', top: '10%', containLabel: true },
      xAxis: {
        type: 'category',
        boundaryGap: true,
        data: trend.dates,
        axisLabel: { rotate: trend.dates.length > 30 ? 30 : 0, fontSize: 11 },
      },
      yAxis: {
        type: 'value',
        name: METRIC_LABELS[metric],
        nameTextStyle: { fontSize: 12, color: '#8a8d99' },
        axisLabel: {
          formatter: (v: number) => v >= 10000 ? `${(v / 10000).toFixed(1)}w` : v.toFixed(0),
        },
      },
      series: seriesData,
    };
  }, [trend, metric]);

  const columns: ColumnsType<FlattenedSummaryItem> = useMemo(() => [
    { title: '平台', dataIndex: 'platform', key: 'platform', width: 100, fixed: 'left' },
    { title: '业务模式', dataIndex: 'business_model', key: 'business_model', width: 100, render: (v: string) => v === '直播' ? <Tag color="magenta">{v}</Tag> : (v || '-') },
    { title: '代理商', dataIndex: 'agency_short', key: 'agency_short', width: 160, render: (v: string, r) => {
      if (r.is_total) return <strong style={{ color: 'var(--color-brand)' }}>{v}</strong>;
      if (r.is_subtotal) return <strong style={{ color: 'var(--chart-color-5)' }}>{v}</strong>;
      return v || '-';
    } },
    { title: '花费', dataIndex: 'cost', key: 'cost', width: 110, align: 'right', render: (v: number) => v ? `¥${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '-' },
    { title: '曝光', dataIndex: 'impressions', key: 'impressions', width: 100, align: 'right', render: (v: number) => v?.toLocaleString() || '-' },
    { title: '点击', dataIndex: 'clicks', key: 'clicks', width: 90, align: 'right', render: (v: number) => v?.toLocaleString() || '-' },
    { title: '线索', dataIndex: 'lead_users', key: 'lead_users', width: 90, align: 'right', render: (v: number) => v?.toLocaleString() || '-' },
    // APP激活业务含义近似线索（前端回传激活），列序紧贴线索后、开户前
    { title: 'APP激活', dataIndex: 'app_activation_users', key: 'app_activation_users', width: 100, align: 'right', render: (v: number) => v?.toLocaleString() || '-' },
    { title: '开户', dataIndex: 'opened_account_users', key: 'opened_account_users', width: 90, align: 'right', render: (v: number) => v?.toLocaleString() || '-' },
    { title: '有效户', dataIndex: 'valid_customer_users', key: 'valid_customer_users', width: 90, align: 'right', render: (v: number) => v?.toLocaleString() || '-' },
    { title: '开户资产', dataIndex: 'opened_account_assets', key: 'opened_account_assets', width: 120, align: 'right', render: (v: number) => v ? `¥${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '-' },
    { title: '线索成本', dataIndex: 'lead_cost', key: 'lead_cost', width: 100, align: 'right', render: (v: number, r) => (r.is_total || r.is_subtotal) ? '-' : (v ? `¥${Number(v).toFixed(2)}` : '-') },
    // APP激活成本列序紧贴线索成本后、开户成本前
    { title: 'APP激活成本', dataIndex: 'app_activation_cost', key: 'app_activation_cost', width: 110, align: 'right', render: (v: number, r) => (r.is_total || r.is_subtotal) ? '-' : (v ? `¥${Number(v).toFixed(2)}` : '-') },
    { title: '开户成本', dataIndex: 'account_cost', key: 'account_cost', width: 100, align: 'right', render: (v: number, r) => (r.is_total || r.is_subtotal) ? '-' : (v ? `¥${Number(v).toFixed(2)}` : '-') },
  ], []);

  const exportCsv = () => {
    if (!visibleSummary.length) return;
    const headers = ['平台', '业务模式', '代理商', '花费', '曝光', '点击', '线索', 'APP激活', '开户', '有效户', '开户资产', '线索成本', 'APP激活成本', '开户成本'];
    const rows = visibleSummary.map((r) => [
      r.platform, r.business_model, r.agency_short || r.agency, r.cost, r.impressions, r.clicks,
      r.lead_users, r.app_activation_users || 0, r.opened_account_users, r.valid_customer_users,
      r.opened_account_assets, r.lead_cost, r.app_activation_cost || 0, r.account_cost,
    ]);
    const csv = '\ufeff' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `厂商分析_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.agencyAnalysisPage}>
      <FadeInSection delay={0} duration={0.8}>
        <FilterBar showPlatform showAgency showBusinessModel onSearch={() => fetchData()} onReset={() => fetchData()} />
      </FadeInSection>

      <FadeInSection delay={0.4} duration={0.8}>
        <MetricSection title="厂商投放概览" description="投放消耗、曝光点击与后端转化核心指标">
          <MetricCard
            title="投放花费"
            value={totals.cost}
            prefix="¥"
            formatter="currency"
            valueColor="var(--color-brand)"
            icon={<DollarOutlined style={{ color: 'var(--color-brand)' }} />}
            description={`广告投放总花费额`}
            showWowChange={false}
          />
          <MetricCard
            title="曝光量"
            value={totals.impressions}
            valueColor="var(--chart-color-2)"
            icon={<EyeOutlined style={{ color: 'var(--chart-color-2)' }} />}
            description={`广告曝光总次数`}
            showWowChange={false}
          />
          <MetricCard
            title="点击量"
            value={totals.clicks}
            valueColor="var(--chart-color-3)"
            icon={<AimOutlined style={{ color: 'var(--chart-color-3)' }} />}
            description={`广告点击总次数`}
            showWowChange={false}
          />
          <MetricCard
            title="线索量"
            value={totals.lead_users}
            valueColor="var(--chart-color-4)"
            icon={<UserOutlined style={{ color: 'var(--chart-color-4)' }} />}
            description={`投放产生的客户线索总数`}
            showWowChange={false}
          />
          <MetricCard
            title="APP激活"
            value={totals.app_activation}
            valueColor="var(--chart-color-6)"
            icon={<ThunderboltOutlined style={{ color: 'var(--chart-color-6)' }} />}
            description={`APP 下载链路激活人数（kiwi/哇棒/有米等）`}
            showWowChange={false}
          />
          <MetricCard
            title="开户量"
            value={totals.opened}
            valueColor="var(--chart-color-5)"
            icon={<TeamOutlined style={{ color: 'var(--chart-color-5)' }} />}
            description={`线索中成功开户人数`}
            showWowChange={false}
          />
          <MetricCard
            title="有效户"
            value={totals.valid}
            valueColor="var(--color-success)"
            icon={<TeamOutlined style={{ color: 'var(--color-success)' }} />}
            description={`入金且资产达标有效户`}
            showWowChange={false}
          />
        </MetricSection>
      </FadeInSection>

      <FadeInSection delay={0.8} duration={0.8}>
        <Card className={styles.chartCard}>
          <div className={styles.cardHeader}>
            <Text type="secondary" className={styles.cardTitle}>📊 日级趋势图（按平台聚合）</Text>
            <Text type="secondary" className={styles.cardDesc}>每日 {METRIC_LABELS[metric]} 趋势</Text>
            <Space size="middle" style={{ marginLeft: 'auto' }}>
              <span className={styles.controlLabel}>指标:</span>
              <Segmented
                value={metric}
                onChange={(v) => setMetric(v as MetricType)}
                options={Object.entries(METRIC_LABELS).map(([k, l]) => ({ label: l, value: k }))}
              />
            </Space>
          </div>
          <Spin spinning={loading}>
            <EChartsComponent option={trendOption} height={360} />
          </Spin>
        </Card>
      </FadeInSection>

      <FadeInSection delay={1.2} duration={0.8}>
        <Card className={styles.tableCard}>
          <div className={styles.cardHeader}>
            <Text type="secondary" className={styles.cardTitle}>📈 平台×代理商聚合数据</Text>
            <Text type="secondary" className={styles.cardDesc}>
              按平台 × 代理商聚合
            </Text>
            <Tooltip title="导出为 CSV" style={{ marginLeft: 'auto' }}>
              <Button type="primary" icon={<DownloadOutlined />} onClick={exportCsv} disabled={!visibleSummary.length}>
                导出 CSV
              </Button>
            </Tooltip>
          </div>
          <Spin spinning={loading}>
            <Table
              columns={columns}
              dataSource={visibleSummary}
              rowKey={(r) => `${r.platform}-${r.business_model}-${r.agency_short||r.agency}-${r.is_total ? 'T' : r.is_subtotal ? 'S' : 'D'}`}
              scroll={{ x: 1200 }}
              pagination={false}
              size="small"
              rowClassName={(r) => {
                if (r.is_total) return 'total-row';
                if (r.is_subtotal) return 'subtotal-row';
                return '';
              }}
            />
          </Spin>
        </Card>
      </FadeInSection>

      <FadeInSection delay={1.6} duration={0.8}>
        <ReportFooter
          sources={[
            { label: '数据源', value: 'agg_vendor_daily' },
            { label: '端点', value: 'GET /api/v1/agency-analysis' },
            { label: '覆盖范围', value: `代理商 ${stats.agency_count ?? 0} 家 · 平台 ${stats.platform_count ?? 0} 个` },
          ]}
          notes={'顶部核心指标为平台 × 代理商 × 业务模式的 SUM，表格按代理商聚合展示，is_subtotal/is_total 行为层级小计/合计；导出 CSV 含全部行。'}
        />
      </FadeInSection>
    </div>
  );
};

export default AgencyAnalysisPage;
