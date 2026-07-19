/**
 * 直播带货 · 业务分析报表 (v3.3.1)
 *
 * 作为「直播获客」二级报表页，专门为带货主播（吴晓宇/杨毅/周乐意）服务，
 * 与「直播漏斗」(全主播)、「主播分析」(全主播) 区分。
 *
 * 数据源: fact_conv_content.客户来源 中 token 命中 dim_anchor_live_type.live_type='带货直播' 的记录
 * 端点:   POST /api/v1/leads-detail/anchor-clusters         (主指标 + 主播详情 + breakdown)
 *         POST /api/v1/leads-detail/anchor-clusters-trend     (走势图 + 热力图)
 *
 * 页面结构（参考 Dashboard + Live/Funnel）:
 *   1. 筛选器（日期 / 主播平台 / 主播多选，直播类型固定为「带货直播」）
 *   2. 核心产出指标卡（5 张：主播数 / 新客户 / 新开户 / 新有效户 / 新开户资产）
 *   3. 主播引流走势图（daily/weekly/monthly 切换）
 *   4. 365 天开户日历热力图（复用 CalendarHeatmap 组件）
 *   5. 6 阶段业务漏斗 + 阶段转化明细表（与 Live/Funnel 同款）
 *   6. 主播详情表（仅带货主播，跨平台聚合）
 *   7. ReportFooter
 *
 * v3.3.1 新增。
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Row, Col, DatePicker, Space, Spin, Table, Tag, Select, Empty, Tooltip, Segmented } from 'antd';
import {
  ReloadOutlined,
  SearchOutlined,
  VideoCameraOutlined,
  UserOutlined,
  RiseOutlined,
  DollarOutlined,
  InfoCircleOutlined,
  AimOutlined,
  CheckCircleOutlined,
  UserAddOutlined,
  ShoppingCartOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { FunnelChart } from '@/components/Chart';
import EChartsComponent from '@/components/Chart/ECharts';
import type { EChartsOption } from 'echarts';
import { ECHARTS_COLORS, pickEChartsColor } from '@/utils/echartsColors';
import { ReportFooter } from '@/components/ReportFooter';
import { MetricCard, MetricSection } from '@/components/MetricCard';
import { FadeInSection } from '@/components';
import { sanitizeText } from '@/utils/sanitizeText';
import { http } from '@/services/http';
import CalendarHeatmap from '@/pages/Dashboard/components/CalendarHeatmap';
import styles from './Funnel.module.scss';

const { RangePicker } = DatePicker;

// 固定 4 类直播类型枚举（本页固定为「带货直播」）
type LiveType = '分析师' | '投顾IP' | '投顾配合做带货' | '带货直播';
const FIXED_LIVE_TYPE: LiveType = '带货直播';

// 配色（与 AnchorCluster / Live/Funnel 一致）
const LIVE_TYPE_COLOR: Record<string, string> = {
  '分析师': 'purple',
  '投顾IP': 'geekblue',
  '投顾配合做带货': 'gold',
  '带货直播': 'magenta',
  '未映射': 'default',
};

const renderLiveTypeTag = (lt: string | null) => {
  if (!lt) return <Tag color="default">未映射</Tag>;
  return <Tag color={LIVE_TYPE_COLOR[lt] || 'default'}>{lt}</Tag>;
};

interface AnchorItem {
  platform: string;
  anchor: string;
  live_type: LiveType | null;
  live_types: LiveType[];
  secondary_live_types: LiveType[];
  leads: number;
  existing_leads: number;
  new_leads: number;
  mouth: number;
  valid_lead: number;
  new_valid_lead: number;
  opened: number;
  new_opened: number;
  existing_opened: number;
  valid: number;
  new_valid: number;
  existing_valid: number;
  assets: number;
  new_assets: number;
  existing_assets: number;
  opening_rate: number;
  valid_rate: number;
  sources: string[];
}

interface AnchorAggRow {
  anchor: string;
  live_type: LiveType | null;
  live_types: LiveType[];
  secondary_live_types: LiveType[];
  platforms: string[];
  leads: number;
  existing_leads: number;
  new_leads: number;
  mouth: number;
  valid_lead: number;
  new_valid_lead: number;
  opened: number;
  new_opened: number;
  existing_opened: number;
  valid: number;
  new_valid: number;
  existing_valid: number;
  assets: number;
  new_assets: number;
  existing_assets: number;
  opening_rate: number;
  valid_rate: number;
  sources: string[];
}

const DirectSalesPage: React.FC = () => {
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([dayjs('2026-01-01'), dayjs('2026-12-31')]);
  const [platformFilter, setPlatformFilter] = useState<string[]>([]);
  const [anchorFilter, setAnchorFilter] = useState<string[]>([]);
  const [items, setItems] = useState<AnchorItem[]>([]);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [anchorOptions, setAnchorOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // 走势图
  const [trendData, setTrendData] = useState<any>(null);
  const [trendGranularity, setTrendGranularity] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [trendLoading, setTrendLoading] = useState(false);

  // 热力图（固定 daily + 365 天滚动窗口，支持「线索数 / 开户数」切换）
  const [heatmapData, setHeatmapData] = useState<{ date: string; value: number }[]>([]);
  const [heatmapLoading, setHeatmapLoading] = useState(false);
  const [heatmapMetric, setHeatmapMetric] = useState<'new_leads' | 'new_opened'>('new_leads');

  const filters = useMemo(() => ({
    start_date: dateRange?.[0]?.format('YYYY-MM-DD'),
    end_date: dateRange?.[1]?.format('YYYY-MM-DD'),
    platforms: platformFilter.length ? platformFilter : undefined,
    // v3.3.1: 固定 live_types = ['带货直播']
    live_types: [FIXED_LIVE_TYPE] as LiveType[],
  }), [dateRange, platformFilter]);

  const resetFilters = () => {
    setDateRange([dayjs('2026-01-01'), dayjs('2026-12-31')]);
    setPlatformFilter([]);
    setAnchorFilter([]);
  };

  // 加载主播聚类数据（已按 live_types=['带货直播'] 过滤）
  const load = async () => {
    setLoading(true);
    try {
      const res: any = await http.post('/leads-detail/anchor-clusters', { filters, top_n: 200 });
      if (res?.success) {
        setItems(res.data.items || []);
        setPlatforms(res.data.platforms || []);
        // 主播选项（用于多选筛选）
        const allAnchors = Array.from(new Set((res.data.items || []).map((it: AnchorItem) => it.anchor))) as string[];
        setAnchorOptions(allAnchors.sort());
      }
    } finally {
      setLoading(false);
    }
  };

  // 走势图（受 dateRange / platformFilter 影响）
  const loadTrend = async () => {
    setTrendLoading(true);
    try {
      const res: any = await http.post('/leads-detail/anchor-clusters-trend', {
        filters,
        granularity: trendGranularity,
      });
      if (res?.success && res.data) setTrendData(res.data);
    } catch (err) {
      console.warn('direct-sales trend load failed', err);
    } finally {
      setTrendLoading(false);
    }
  };

  // 热力图（固定 daily + 滚动 365 天，不受顶部 trendGranularity 影响）
  const loadHeatmap = async () => {
    setHeatmapLoading(true);
    try {
      const today = dayjs();
      const start = today.subtract(364, 'day').format('YYYY-MM-DD');
      const end = today.format('YYYY-MM-DD');
      const res: any = await http.post('/leads-detail/anchor-clusters-trend', {
        filters: {
          ...filters,
          start_date: start,
          end_date: end,
        },
        granularity: 'daily',
      });
      if (res?.success && res.data?.totals) {
        const arr = Object.entries(res.data.totals).map(([date, v]: [string, any]) => ({
          date,
          value: Number(v?.[heatmapMetric] || 0),
        }));
        setHeatmapData(arr);
      }
    } catch (err) {
      console.warn('direct-sales heatmap load failed', err);
    } finally {
      setHeatmapLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filters]);
  useEffect(() => { loadTrend(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filters, trendGranularity]);
  useEffect(() => { loadHeatmap(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filters, heatmapMetric]);

  // 主播名多选筛选（前端二次过滤 items）
  const filteredItems = useMemo(() => {
    if (!anchorFilter.length) return items;
    return items.filter((it) => anchorFilter.includes(it.anchor));
  }, [items, anchorFilter]);

  // 6 阶段漏斗（与 Live/Funnel 同口径）
  const funnelStages = useMemo(() => {
    const total = filteredItems.reduce((acc, it) => ({
      leads: acc.leads + it.leads,
      mouth: acc.mouth + it.mouth,
      valid_lead: acc.valid_lead + it.valid_lead,
      new_valid_lead: acc.new_valid_lead + (it.new_valid_lead || 0),
      new_opened: acc.new_opened + (it.new_opened || 0),
      new_valid: acc.new_valid + (it.new_valid || 0),
    }), { leads: 0, mouth: 0, valid_lead: 0, new_valid_lead: 0, new_opened: 0, new_valid: 0 });
    const top = total.leads || 1;
    const pct = (v: number, base: number) => (base > 0 ? +(v / base * 100).toFixed(2) : 0);
    const stages = [
      { step: '客户线索', value: total.leads },
      { step: '客户开口', value: total.mouth },
      { step: '有效线索', value: total.valid_lead },
      { step: '有效线索(剔除存量)', value: total.new_valid_lead },
      { step: '成功开户(新)', value: total.new_opened },
      { step: '有效户(新)', value: total.new_valid },
    ];
    let prev = total.leads;
    return stages.map((s) => {
      const rate = pct(s.value, prev);
      const step_rate = pct(s.value, top);
      const out = { ...s, rate, step_rate };
      prev = s.value;
      return out;
    });
  }, [filteredItems]);

  const funnelChartData = useMemo(() => funnelStages.map((s) => ({
    name: sanitizeText(s.step),
    count: s.value,
    rate: s.rate,
    conversionRate: s.rate,
  })), [funnelStages]);

  // 走势图 option（与 Live/Funnel 同款，多 series 按平台拆）
  const trendOption: EChartsOption = useMemo(() => {
    if (!trendData?.periods?.length || !trendData?.by_platform) return {};
    const periods = trendData.periods as string[];
    const platformsList = (trendData.platforms || []) as string[];
    const by_platform: Record<string, any> = trendData.by_platform;
    const totals: Record<string, any> = trendData.totals || {};
    const metric = (p: string, period: string, key: string) => by_platform?.[period]?.[p]?.[key] ?? 0;
    const series = platformsList.map((p, idx) => ({
      name: p,
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      itemStyle: { color: pickEChartsColor(idx) },
      lineStyle: { width: 2 },
      areaStyle: { color: pickEChartsColor(idx), opacity: 0.08 },
      data: periods.map((period) => metric(p, period, 'new_opened')),
    }));
    const totalSeries = {
      name: '合计新开户',
      type: 'line',
      smooth: true,
      symbol: 'diamond',
      symbolSize: 8,
      itemStyle: { color: ECHARTS_COLORS[7] },
      lineStyle: { width: 3, type: 'dashed' },
      data: periods.map((p) => totals[p]?.new_opened ?? 0),
    };
    return {
      tooltip: { trigger: 'axis', valueFormatter: (v: any) => Number(v || 0).toLocaleString() },
      legend: { bottom: 0, type: 'scroll' },
      grid: { left: '3%', right: '4%', bottom: '12%', top: '10%', containLabel: true },
      xAxis: { type: 'category', data: periods, axisLabel: { rotate: trendGranularity === 'daily' ? 30 : 0 } },
      yAxis: [{ type: 'value', name: '新开户(人)' }],
      series: [...series, totalSeries],
    };
  }, [trendData, trendGranularity]);

  // 汇总指标
  const totals = useMemo(() => {
    const sum = (sel: (i: AnchorItem) => number) => filteredItems.reduce((s, i) => s + (sel(i) || 0), 0);
    return {
      anchors: new Set(filteredItems.map((i) => i.anchor)).size,
      leads: sum((i) => i.leads),
      existing_leads: sum((i) => i.existing_leads || 0),
      new_leads: sum((i) => i.new_leads || 0),
      mouth: sum((i) => i.mouth),
      valid_lead: sum((i) => i.valid_lead),
      new_valid_lead: sum((i) => i.new_valid_lead || 0),
      opened: sum((i) => i.opened),
      new_opened: sum((i) => i.new_opened || 0),
      existing_opened: sum((i) => i.existing_opened || 0),
      valid: sum((i) => i.valid),
      new_valid: sum((i) => i.new_valid || 0),
      existing_valid: sum((i) => i.existing_valid || 0),
      assets: sum((i) => i.assets),
      new_assets: sum((i) => i.new_assets || 0),
      existing_assets: sum((i) => i.existing_assets || 0),
    };
  }, [filteredItems]);

  // 同名主播跨平台聚合（与 Live/Funnel 同款）
  const anchorAggRows: AnchorAggRow[] = useMemo(() => {
    const map = new Map<string, AnchorAggRow>();
    filteredItems.forEach((it) => {
      if (platformFilter.length && !platformFilter.includes(it.platform)) return;
      const r = map.get(it.anchor) || {
        anchor: it.anchor, platforms: [], leads: 0, existing_leads: 0, new_leads: 0, mouth: 0,
        valid_lead: 0, new_valid_lead: 0,
        opened: 0, new_opened: 0, existing_opened: 0,
        valid: 0, new_valid: 0, existing_valid: 0,
        assets: 0, new_assets: 0, existing_assets: 0,
        opening_rate: 0, valid_rate: 0, sources: [],
        live_type: null as LiveType | null, live_types: [] as LiveType[], secondary_live_types: [] as LiveType[],
      };
      if (!r.platforms.includes(it.platform)) r.platforms.push(it.platform);
      r.leads += it.leads;
      r.existing_leads += it.existing_leads || 0;
      r.new_leads += it.new_leads || 0;
      r.mouth += it.mouth;
      r.valid_lead += it.valid_lead;
      r.new_valid_lead += it.new_valid_lead || 0;
      r.opened += it.opened;
      r.new_opened += it.new_opened || 0;
      r.existing_opened += it.existing_opened || 0;
      r.valid += it.valid;
      r.new_valid += it.new_valid || 0;
      r.existing_valid += it.existing_valid || 0;
      r.assets += it.assets;
      r.new_assets += it.new_assets || 0;
      r.existing_assets += it.existing_assets || 0;
      r.sources = Array.from(new Set([...r.sources, ...(it.sources || [])]));
      // 合并 live_types
      const mergedTypes = Array.from(new Set([...r.live_types, ...(it.live_types || [])])) as LiveType[];
      r.live_types = mergedTypes;
      if (!r.live_type && it.live_type) r.live_type = it.live_type;
      r.secondary_live_types = r.live_types.filter((t) => t !== r.live_type);
      map.set(it.anchor, r);
    });
    const rows = Array.from(map.values());
    rows.forEach((r) => {
      r.opening_rate = r.leads ? +(r.new_opened / r.leads * 100).toFixed(2) : 0;
      r.valid_rate = r.leads ? +(r.new_valid / r.leads * 100).toFixed(2) : 0;
    });
    rows.sort((a, b) => b.leads - a.leads);
    return rows;
  }, [filteredItems, platformFilter]);

  const anchorAggColumns = [
    { title: '主播', dataIndex: 'anchor', width: 130, fixed: 'left' as const, render: (v: string) => <strong>{sanitizeText(v)}</strong> },
    {
      title: '直播类型',
      dataIndex: 'live_type',
      width: 130,
      render: (_: any, r: AnchorAggRow) => (
        <Space direction="vertical" size={2}>
          {renderLiveTypeTag(r.live_type)}
          {(r.secondary_live_types || []).length > 0 && (
            <Tooltip title={`该主播跨 token 涉及多种直播类型：${r.live_types.join('、')}`}>
              <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                +{r.secondary_live_types.length} 类型
              </span>
            </Tooltip>
          )}
        </Space>
      ),
    },
    { title: '覆盖平台', dataIndex: 'platforms', width: 200, render: (v: string[]) => (
      <Space size={[4, 4]} wrap>
        {v.map((p) => <Tag key={p} color="cyan">{sanitizeText(p)}</Tag>)}
      </Space>
    ) },
    { title: '平台数', width: 80, align: 'center' as const, render: (_: any, r: AnchorAggRow) => <Tag color="blue">{r.platforms.length}</Tag> },
    { title: '线索量', dataIndex: 'leads', align: 'right' as const, width: 100, sorter: (a: AnchorAggRow, b: AnchorAggRow) => a.leads - b.leads, defaultSortOrder: 'descend' as const, render: (v: number) => v.toLocaleString() },
    { title: '新客户', dataIndex: 'new_leads', align: 'right' as const, width: 90, render: (v: number) => v.toLocaleString() },
    { title: '开口量', dataIndex: 'mouth', align: 'right' as const, width: 90, render: (v: number) => v.toLocaleString() },
    { title: '有效线索', dataIndex: 'valid_lead', align: 'right' as const, width: 100, render: (v: number) => v.toLocaleString() },
    { title: '有效(非存量)', dataIndex: 'new_valid_lead', align: 'right' as const, width: 110, render: (v: number) => v.toLocaleString() },
    { title: '新开户', dataIndex: 'new_opened', align: 'right' as const, width: 90, sorter: (a: AnchorAggRow, b: AnchorAggRow) => a.new_opened - b.new_opened, render: (v: number) => v.toLocaleString() },
    { title: '新有效户', dataIndex: 'new_valid', align: 'right' as const, width: 90, sorter: (a: AnchorAggRow, b: AnchorAggRow) => a.new_valid - b.new_valid, render: (v: number) => v.toLocaleString() },
    { title: '新开户率', dataIndex: 'opening_rate', align: 'right' as const, width: 100, sorter: (a: AnchorAggRow, b: AnchorAggRow) => a.opening_rate - b.opening_rate, render: (v: number) => <Tag color={v > 5 ? 'green' : v > 1 ? 'gold' : 'default'}>{v.toFixed(2)}%</Tag> },
    { title: '新有效率', dataIndex: 'valid_rate', align: 'right' as const, width: 100, render: (v: number) => <Tag color={v > 3 ? 'green' : v > 1 ? 'gold' : 'default'}>{v.toFixed(2)}%</Tag> },
    { title: '新开户资产', dataIndex: 'new_assets', align: 'right' as const, width: 140, sorter: (a: AnchorAggRow, b: AnchorAggRow) => a.new_assets - b.new_assets, render: (v: number) => v ? `¥${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '-' },
  ];

  return (
    <div className={styles.page}>
      <FadeInSection delay={0} duration={0.8}>
        <Card className={styles.filterCard} size="small">
          <Space size="middle" wrap>
            <span className={styles.label}>日期区间</span>
            <RangePicker value={dateRange} onChange={(v) => v && v[0] && v[1] && setDateRange([v[0], v[1]])} allowClear={false} />
            <span className={styles.label}>主播平台</span>
            <Select
              mode="multiple"
              allowClear
              placeholder={'全部'}
              value={platformFilter}
              onChange={setPlatformFilter}
              options={platforms.map((p) => ({ label: p, value: p }))}
              style={{ minWidth: 200 }}
              maxTagCount="responsive"
            />
            <span className={styles.label}>主播</span>
            <Select
              mode="multiple"
              allowClear
              showSearch
              placeholder={'全部带货主播'}
              value={anchorFilter}
              onChange={(v) => setAnchorFilter(v as string[])}
              options={anchorOptions.map((a) => ({ label: a, value: a }))}
              style={{ minWidth: 220 }}
              maxTagCount="responsive"
              filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())}
            />
            <Tag color="magenta" style={{ marginLeft: 4 }}>直播类型：带货直播（固定）</Tag>
            <Button type="primary" icon={<SearchOutlined />} onClick={load}>查询</Button>
            <Button icon={<ReloadOutlined />} onClick={resetFilters}>重置</Button>
          </Space>
        </Card>
      </FadeInSection>

      <Spin spinning={loading}>
        <FadeInSection delay={0.4} duration={0.8}>
          <MetricSection title="直播带货核心产出" description="带货主播（吴晓宇/杨毅/周乐意 等）的新客户获客主指标（仅统计非存量客户）">
            <MetricCard title="带货主播数" value={totals.anchors} valueColor="var(--color-brand)" icon={<ShoppingCartOutlined style={{ color: 'var(--color-brand)' }} />} description={`直播类型=带货直播的主播数`} showWowChange={false} />
            <MetricCard title="新客户" value={totals.new_leads} valueColor="var(--color-brand)" icon={<UserAddOutlined style={{ color: 'var(--color-brand)' }} />} description={`非存量线索·核心获客容量`} showWowChange={false} />
            <MetricCard title="新开户" value={totals.new_opened} valueColor="var(--color-error)" icon={<AimOutlined style={{ color: 'var(--color-error)' }} />} description={`非存量且成功开户人数·主指标`} showWowChange={false} />
            <MetricCard title="新有效户" value={totals.new_valid} valueColor="var(--color-success)" icon={<CheckCircleOutlined style={{ color: 'var(--color-success)' }} />} description={`非存量且有效户人数·主指标`} showWowChange={false} />
            <MetricCard title="新开户资产" value={totals.new_assets} prefix="¥" formatter="currency" valueColor="var(--color-warning)" icon={<DollarOutlined style={{ color: 'var(--color-warning)' }} />} description={`非存量且开户成功客户总资产·主指标`} showWowChange={false} />
          </MetricSection>
        </FadeInSection>

        <FadeInSection delay={0.8} duration={0.8}>
          <Card size="small" style={{ marginBottom: 16 }}>
            <Row align="middle" gutter={12} style={{ marginBottom: 12 }}>
              <Col flex="auto">
                <Space size={8} align="center">
                  <RiseOutlined style={{ color: 'var(--color-brand)' }} />
                  <strong>带货主播引流走势</strong>
                  <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>
                    按 {trendData?.granularity || 'monthly'} 口径汇总，按平台拆多 series (新开户)
                  </span>
                </Space>
              </Col>
              <Col>
                <Segmented
                  size="small"
                  value={trendGranularity}
                  onChange={(v) => setTrendGranularity(v as 'daily' | 'weekly' | 'monthly')}
                  options={[
                    { label: '按日', value: 'daily' },
                    { label: '按周', value: 'weekly' },
                    { label: '按月', value: 'monthly' },
                  ]}
                />
              </Col>
            </Row>
            {trendData?.periods?.length ? (
              <EChartsComponent option={trendOption} height={320} loading={trendLoading} />
            ) : (
              <Empty description={trendLoading ? '加载中...' : '暂无走势数据'} />
            )}
          </Card>
        </FadeInSection>

        <FadeInSection delay={1.2} duration={0.8}>
          <Card
            size="small"
            style={{ marginBottom: 16 }}
            title={
              <Space size={8} align="center">
                <VideoCameraOutlined style={{ color: 'var(--color-brand)' }} />
                <span>365 天带货主播日历</span>
                <Tooltip title="滚动 365 天窗口；颜色越深表示当日数量越多，便于发现直播节奏。开户数通常较少（转化率 1-5%），可切到「线索数」查看更丰富的热力分布">
                  <InfoCircleOutlined style={{ color: 'var(--color-text-tertiary)' }} />
                </Tooltip>
              </Space>
            }
            extra={
              <Segmented
                size="small"
                value={heatmapMetric}
                onChange={(v) => setHeatmapMetric(v as 'new_leads' | 'new_opened')}
                options={[
                  { label: '线索数', value: 'new_leads' },
                  { label: '开户数', value: 'new_opened' },
                ]}
              />
            }
          >
            <CalendarHeatmap data={heatmapData} loading={heatmapLoading} days={365} />
          </Card>
        </FadeInSection>

        <FadeInSection delay={1.6} duration={0.8}>
          <Row className={styles.funnelSplitRow}>
            <Col span={12} className={styles.funnelSplitCol}>
              <Card title="6 阶段直播带货业务漏斗" size="small" className={styles.h100Card} extra={<Tooltip title="占比 = 当前阶段人数 ÷ 最大阶段人数（条形长度按比例绘制，已启用对数尺度缓解各级数据偏差）；阶段间百分比 = 上一阶段 → 当前阶段的转化率"><InfoCircleOutlined style={{ color: 'var(--color-text-tertiary)' }} /></Tooltip>}>
                {funnelChartData.length > 0 && funnelChartData[0].count > 0 ? (
                  <FunnelChart data={funnelChartData} height={440} useLogScale />
                ) : (
                  <Empty description="该日期区间内无带货主播引流记录" />
                )}
              </Card>
            </Col>
            <Col span={12} className={styles.funnelSplitCol}>
              <Card title="阶段转化明细" size="small" className={styles.h100Card}>
                <table className={styles.stageTable}>
                  <thead>
                    <tr>
                      <th className={styles.colNum}>#</th>
                      <th>阶段</th>
                      <th className={styles.colNum}>累计人数</th>
                      <th className={styles.colNum}>阶段转化率</th>
                      <th className={styles.colNum}>累计转化率</th>
                    </tr>
                  </thead>
                  <tbody>
                    {funnelStages.map((s, idx) => (
                      <tr key={s.step}>
                        <td className={styles.colNum}>{idx + 1}</td>
                        <td>{sanitizeText(s.step)}</td>
                        <td className={styles.colNum}>{s.value.toLocaleString()}</td>
                        <td className={styles.colNum}>
                          <Tag color={s.rate > 50 ? 'green' : s.rate > 10 ? 'gold' : 'default'}>
                            {s.rate.toFixed(2)}%
                          </Tag>
                        </td>
                        <td className={styles.colNum}>
                          <Tag color={s.step_rate > 30 ? 'green' : s.step_rate > 5 ? 'gold' : 'default'}>
                            {s.step_rate.toFixed(2)}%
                          </Tag>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </Col>
          </Row>
        </FadeInSection>

        <FadeInSection delay={2.0} duration={0.8}>
          <Card title={`带货主播详情（${anchorAggRows.length} 位主播·同名跨平台聚合）`} size="small" extra={<span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>按线索量降序</span>}>
            {anchorAggRows.length > 0 ? (
              <Table<AnchorAggRow> size="small" rowKey="anchor" dataSource={anchorAggRows} pagination={false} columns={anchorAggColumns as any} scroll={{ x: 'max-content' }} />
            ) : (
              <Empty description={'暂无带货主播数据（请检查日期区间是否覆盖直播带货时段）'} />
            )}
          </Card>
        </FadeInSection>

        <FadeInSection delay={2.4} duration={0.8}>
          <ReportFooter
            sources={[
              { label: '数据源', value: 'fact_conv_content.客户来源 中 token 命中 dim_anchor_live_type.live_type=\'带货直播\' 的记录（如 直播带货-吴晓宇 / 直播带货-杨毅 / 直播带货-周乐意 / 抖音引流-吴晓宇 等）' },
              { label: '端点', value: 'POST /api/v1/leads-detail/anchor-clusters（filters.live_types=[\'带货直播\']）' },
              { label: '走势图端点', value: 'POST /api/v1/leads-detail/anchor-clusters-trend（daily/weekly/monthly，filters.live_types=[\'带货直播\']）' },
              { label: '热力图口径', value: '滚动 365 天窗口 + daily 粒度，支持「线索数 / 开户数」切换（取 totals[period].new_leads 或 new_opened）' },
              { label: '存量剔除口径', value: '非存量 = 是否为存量客户==0 OR IS NULL，与 cost_analysis/conversion-funnel/split 一致' },
              { label: '主播聚合', value: '同名主播跨平台聚合（覆盖平台 + 平台数列展开），支持上方主播平台/主播多选筛选' },
              { label: '配置方式', value: 'backend/config/anchor_live_types.json（JSON 权威源，启动时 _sync_anchor_live_types_from_json 自动 upsert 到 DB）' },
            ]}
            notes={'v3.3.1 新增：作为「直播获客」二级报表页，专门为带货主播服务，与「直播漏斗」(全主播)、「主播分析」(全主播) 区分。直播类型固定为「带货直播」，不可切换。新开户作为核心获客产出：漏斗第 4 阶段起剔除存量客户，「成功开户(新)」「有效户(新)」「新开户资产」为主指标。'}
          />
        </FadeInSection>
      </Spin>
    </div>
  );
};

export default DirectSalesPage;
