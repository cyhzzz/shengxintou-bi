/**
 * 直播获客 · 业务漏斗 (v3.2)
 * 数据源: fact_conv_content.客户来源（识别 [平台]引流-[主播] 模式的主播引流量）
 * 端点: POST /api/v1/leads-detail/anchor-clusters
 *
 * 6 阶段漏斗（v3.1.26 业务口径，与内容平台漏斗对齐的存量剔除口径）:
 *   客户线索 → 客户开口 → 有效线索 → 有效线索(剔除存量) → 成功开户(新) → 有效户(新)
 *
 * 「成功开户(新)」与「有效户(新)」仅统计非存量客户（是否为存量客户=0 或 NULL），
 * 与 cost_analysis/conversion-funnel/split 一致。存量客户在「有效线索」之后剔除，
 * 漏斗呈现新开户作为核心获客产出。
 *
 * 直播明细表数据源暂未接入（v3.1 占位已下线，v3.2 接入后补 观看UV 阶段）
 * 当前以主播引流链路作为"直播业务漏斗"的替代口径。
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Row, Col, DatePicker, Space, Spin, Table, Tag, Select, Empty, Tooltip, Segmented } from 'antd';
import { ReloadOutlined, SearchOutlined, VideoCameraOutlined, UserOutlined, RiseOutlined, DollarOutlined, FireOutlined, InfoCircleOutlined, AimOutlined, CheckCircleOutlined, UserAddOutlined } from '@ant-design/icons';
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
import styles from './Funnel.module.scss';

const { RangePicker } = DatePicker;

// v3.3.0: 直播类型（4 类，由 dim_anchor_live_type 表映射）
type LiveType = '分析师' | '投顾IP' | '投顾配合做带货' | '带货直播';

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

interface PlatformRow {
  platform: string;
  anchors: number;
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
  mouth_rate: number;
  valid_lead_rate: number;
  new_opening_rate: number;
  opening_rate: number;
  new_valid_rate: number;
  valid_rate: number;
}

// 同名主播跨平台聚合行（v3.1.26 问题2）
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

// v3.3.0: live_type 配色
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

const LiveFunnelPage: React.FC = () => {
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([dayjs('2026-01-01'), dayjs('2026-12-31')]);
  const [platformFilter, setPlatformFilter] = useState<string[]>([]);
  // v3.3.0: 直播类型筛选
  const [liveTypeFilter, setLiveTypeFilter] = useState<LiveType[]>([]);
  const [liveTypeOptions, setLiveTypeOptions] = useState<string[]>([]);
  const [items, setItems] = useState<AnchorItem[]>([]);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [trendData, setTrendData] = useState<any>(null);
  const [trendGranularity, setTrendGranularity] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [trendLoading, setTrendLoading] = useState(false);

  const filters = useMemo(() => ({
    start_date: dateRange?.[0]?.format('YYYY-MM-DD'),
    end_date: dateRange?.[1]?.format('YYYY-MM-DD'),
    platforms: platformFilter.length ? platformFilter : undefined,
    // v3.3.0: 把直播类型筛选传给后端
    live_types: liveTypeFilter.length ? liveTypeFilter : undefined,
  }), [dateRange, platformFilter, liveTypeFilter]);

  const resetFilters = () => {
    setDateRange([dayjs('2026-01-01'), dayjs('2026-12-31')]);
    setPlatformFilter([]);
    setLiveTypeFilter([]);
  };

  const load = async () => {
    setLoading(true);
    try {
      const res: any = await http.post('/leads-detail/anchor-clusters', { filters, top_n: 200 });
      if (res?.success) {
        setItems(res.data.items || []);
        setPlatforms(res.data.platforms || []);
        setLiveTypeOptions(res.data.live_types || []);
      }
    } finally {
      setLoading(false);
    }
  };

  // v3.1.27: 主播引流走势 — 按日/周/月聚合（与 /leads-detail/anchor-clusters 同口径）
  const loadTrend = async () => {
    setTrendLoading(true);
    try {
      const res: any = await http.post('/leads-detail/anchor-clusters-trend', {
        filters,
        granularity: trendGranularity,
      });
      if (res?.success && res.data) setTrendData(res.data);
    } catch (err) {
      console.warn('anchor trend load failed', err);
    } finally {
      setTrendLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filters]);
  useEffect(() => { loadTrend(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filters, trendGranularity]);

  // 6 阶段漏斗（v3.1.26 业务口径: 线索 → 开口 → 有效线索 → 有效线索(剔除存量) → 成功开户(新) → 有效户(新)）
  // stage.rate = 阶段转化率（此阶段 / 上一阶段）；stage.step_rate = 累计转化率（此阶段 / 顶端线索）
  const funnelStages = useMemo(() => {
    const total = items.reduce((acc, it) => ({
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
  }, [items]);

  // FunnelChart 组件期望 {name, count, rate, conversionRate}
  const funnelChartData = useMemo(() => funnelStages.map((s) => ({
    name: sanitizeText(s.step),
    count: s.value,
    rate: s.rate,
    conversionRate: s.rate,
  })), [funnelStages]);

  // v3.1.27: 主播引流走势图选项 (多 series 按平台拆)
  const trendOption: EChartsOption = useMemo(() => {
    if (!trendData?.periods?.length || !trendData?.by_platform) return {};
    const periods = trendData.periods as string[];
    const platforms = (trendData.platforms || []) as string[];
    const by_platform: Record<string, any> = trendData.by_platform;
    const totals: Record<string, any> = trendData.totals || {};
    const metric = (p: string, period: string, key: string) => by_platform?.[period]?.[p]?.[key] ?? 0;
    const series = platforms.map((p, idx) => ({
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

  const totals = useMemo(() => {
    const sum = (sel: (i: AnchorItem) => number) => items.reduce((s, i) => s + (sel(i) || 0), 0);
    return {
      anchors: items.length,
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
  }, [items]);

  const platformRows: PlatformRow[] = useMemo(() => {
    const map = new Map<string, PlatformRow>();
    items.forEach((it) => {
      const r = map.get(it.platform) || {
        platform: it.platform, anchors: 0, leads: 0, existing_leads: 0, new_leads: 0, mouth: 0,
        valid_lead: 0, new_valid_lead: 0,
        opened: 0, new_opened: 0, existing_opened: 0,
        valid: 0, new_valid: 0, existing_valid: 0,
        assets: 0, new_assets: 0, existing_assets: 0,
        mouth_rate: 0, valid_lead_rate: 0,
        new_opening_rate: 0, opening_rate: 0,
        new_valid_rate: 0, valid_rate: 0,
      };
      r.anchors += 1;
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
      map.set(it.platform, r);
    });
    const rows = Array.from(map.values());
    rows.forEach((r) => {
      r.mouth_rate = r.leads ? +(r.mouth / r.leads * 100).toFixed(2) : 0;
      r.valid_lead_rate = r.leads ? +(r.valid_lead / r.leads * 100).toFixed(2) : 0;
      r.new_opening_rate = r.leads ? +(r.new_opened / r.leads * 100).toFixed(2) : 0;
      r.opening_rate = r.leads ? +(r.opened / r.leads * 100).toFixed(2) : 0;
      r.new_valid_rate = r.leads ? +(r.new_valid / r.leads * 100).toFixed(2) : 0;
      r.valid_rate = r.leads ? +(r.valid / r.leads * 100).toFixed(2) : 0;
    });
    rows.sort((a, b) => b.leads - a.leads);
    return rows;
  }, [items]);

  // v3.1.26 问题2: 同名主播跨平台聚合（支持平台多选筛选）
  // v3.3.0: 合并 live_types（取所有 token 的并集），primary 取第一个非空
  const anchorAggRows: AnchorAggRow[] = useMemo(() => {
    const map = new Map<string, AnchorAggRow>();
    items.forEach((it) => {
      // 平台筛选：选中平台时只聚合命中平台的主播行
      if (platformFilter.length && !platformFilter.includes(it.platform)) return;
      const r = map.get(it.anchor) || {
        anchor: it.anchor, platforms: [], live_type: null, live_types: [], secondary_live_types: [],
        leads: 0, existing_leads: 0, new_leads: 0, mouth: 0,
        valid_lead: 0, new_valid_lead: 0,
        opened: 0, new_opened: 0, existing_opened: 0,
        valid: 0, new_valid: 0, existing_valid: 0,
        assets: 0, new_assets: 0, existing_assets: 0,
        opening_rate: 0, valid_rate: 0, sources: [],
      };
      if (!r.platforms.includes(it.platform)) r.platforms.push(it.platform);
      // v3.3.0: 主播级 live_type 取所有 token 的并集
      const mergedTypes = Array.from(new Set([...r.live_types, ...(it.live_types || [])])) as LiveType[];
      r.live_types = mergedTypes;
      if (!r.live_type && it.live_type) r.live_type = it.live_type;
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
      map.set(it.anchor, r);
    });
    const rows = Array.from(map.values());
    rows.forEach((r) => {
      r.opening_rate = r.leads ? +(r.new_opened / r.leads * 100).toFixed(2) : 0;
      r.valid_rate = r.leads ? +(r.new_valid / r.leads * 100).toFixed(2) : 0;
      // v3.3.0: 二级类型 = 全部类型去掉 primary 后剩下的
      r.secondary_live_types = r.live_types.filter((t) => t !== r.live_type);
    });
    rows.sort((a, b) => b.leads - a.leads);
    return rows;
  }, [items, platformFilter]);

  const platformColumns = [
    { title: '平台', dataIndex: 'platform', width: 120, render: (v: string) => <Tag color="cyan">{v}</Tag> },
    { title: '主播数', dataIndex: 'anchors', align: 'right' as const, width: 100, sorter: (a: PlatformRow, b: PlatformRow) => a.anchors - b.anchors, defaultSortOrder: 'descend' as const, render: (v: number) => v.toLocaleString() },
    { title: '线索', dataIndex: 'leads', align: 'right' as const, width: 110, sorter: (a: PlatformRow, b: PlatformRow) => a.leads - b.leads, render: (v: number) => v.toLocaleString() },
    { title: '存量客户', dataIndex: 'existing_leads', align: 'right' as const, width: 110, render: (v: number) => v.toLocaleString() },
    { title: '新客户', dataIndex: 'new_leads', align: 'right' as const, width: 100, render: (v: number) => v.toLocaleString() },
    { title: '开口', dataIndex: 'mouth', align: 'right' as const, width: 100, render: (v: number) => v.toLocaleString() },
    { title: '有效线索', dataIndex: 'valid_lead', align: 'right' as const, width: 110, render: (v: number) => v.toLocaleString() },
    { title: '有效线索(非存量)', dataIndex: 'new_valid_lead', align: 'right' as const, width: 130, render: (v: number) => v.toLocaleString() },
    { title: '新开户', dataIndex: 'new_opened', align: 'right' as const, width: 100, sorter: (a: PlatformRow, b: PlatformRow) => a.new_opened - b.new_opened, render: (v: number) => v.toLocaleString() },
    { title: '新有效户', dataIndex: 'new_valid', align: 'right' as const, width: 100, sorter: (a: PlatformRow, b: PlatformRow) => a.new_valid - b.new_valid, render: (v: number) => v.toLocaleString() },
    { title: '开口率', dataIndex: 'mouth_rate', align: 'right' as const, width: 100, render: (v: number) => <Tag color={v > 60 ? 'green' : v > 30 ? 'gold' : 'default'}>{v.toFixed(2)}%</Tag> },
    { title: '新开户率', dataIndex: 'new_opening_rate', align: 'right' as const, width: 100, sorter: (a: PlatformRow, b: PlatformRow) => a.new_opening_rate - b.new_opening_rate, render: (v: number) => <Tag color={v > 5 ? 'green' : v > 1 ? 'gold' : 'default'}>{v.toFixed(2)}%</Tag> },
    { title: '新有效率', dataIndex: 'new_valid_rate', align: 'right' as const, width: 100, render: (v: number) => <Tag color={v > 3 ? 'green' : v > 1 ? 'gold' : 'default'}>{v.toFixed(2)}%</Tag> },
    { title: '新开户资产', dataIndex: 'new_assets', align: 'right' as const, width: 140, sorter: (a: PlatformRow, b: PlatformRow) => a.new_assets - b.new_assets, render: (v: number) => v ? `¥${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '-' },
    { title: '存量资产', dataIndex: 'existing_assets', align: 'right' as const, width: 140, render: (v: number) => v ? `¥${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '-' },
  ];

  // v3.1.26 问题2: 主播详情表改为同名跨平台聚合，"平台"列改为"覆盖平台"多 Tag
  // v3.3.0: 新增「直播类型」列
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
    { title: '存量客户', dataIndex: 'existing_leads', align: 'right' as const, width: 100, render: (v: number) => v.toLocaleString() },
    { title: '新客户', dataIndex: 'new_leads', align: 'right' as const, width: 90, render: (v: number) => v.toLocaleString() },
    { title: '开口量', dataIndex: 'mouth', align: 'right' as const, width: 90, render: (v: number) => v.toLocaleString() },
    { title: '有效线索', dataIndex: 'valid_lead', align: 'right' as const, width: 100, render: (v: number) => v.toLocaleString() },
    { title: '有效(非存量)', dataIndex: 'new_valid_lead', align: 'right' as const, width: 110, render: (v: number) => v.toLocaleString() },
    { title: '新开户', dataIndex: 'new_opened', align: 'right' as const, width: 90, sorter: (a: AnchorAggRow, b: AnchorAggRow) => a.new_opened - b.new_opened, render: (v: number) => v.toLocaleString() },
    { title: '新有效户', dataIndex: 'new_valid', align: 'right' as const, width: 90, sorter: (a: AnchorAggRow, b: AnchorAggRow) => a.new_valid - b.new_valid, render: (v: number) => v.toLocaleString() },
    { title: '新开户率', dataIndex: 'opening_rate', align: 'right' as const, width: 100, sorter: (a: AnchorAggRow, b: AnchorAggRow) => a.opening_rate - b.opening_rate, render: (v: number) => <Tag color={v > 5 ? 'green' : v > 1 ? 'gold' : 'default'}>{v.toFixed(2)}%</Tag> },
    { title: '新有效率', dataIndex: 'valid_rate', align: 'right' as const, width: 100, render: (v: number) => <Tag color={v > 3 ? 'green' : v > 1 ? 'gold' : 'default'}>{v.toFixed(2)}%</Tag> },
    { title: '新开户资产', dataIndex: 'new_assets', align: 'right' as const, width: 140, sorter: (a: AnchorAggRow, b: AnchorAggRow) => a.new_assets - b.new_assets, render: (v: number) => v ? `¥${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '-' },
    { title: '存量资产', dataIndex: 'existing_assets', align: 'right' as const, width: 140, render: (v: number) => v ? `¥${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '-' },
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
            <span className={styles.label}>直播类型</span>
            <Select
              mode="multiple"
              allowClear
              placeholder={'全部类型'}
              value={liveTypeFilter}
              onChange={(v) => setLiveTypeFilter(v as LiveType[])}
              options={liveTypeOptions.map((t) => ({ label: t, value: t }))}
              style={{ minWidth: 200 }}
              maxTagCount="responsive"
            />
            <Button type="primary" icon={<SearchOutlined />} onClick={load}>查询</Button>
            <Button icon={<ReloadOutlined />} onClick={resetFilters}>重置</Button>
          </Space>
        </Card>
      </FadeInSection>

      <Spin spinning={loading}>
        <FadeInSection delay={0.4} duration={0.8}>
          <MetricSection title="直播获客核心产出" description="同名主播跨平台去重后的新客户获客主指标（仅统计非存量客户，v3.1.25 起坚持这一口径）">
          <MetricCard title="主播数" value={totals.anchors} valueColor="var(--color-brand)" icon={<VideoCameraOutlined style={{ color: 'var(--color-brand)' }} />} description={`同名主播跨平台去重后的活跃主播数量`} showWowChange={false} />
          <MetricCard title="新客户" value={totals.new_leads} valueColor="var(--color-brand)" icon={<UserAddOutlined style={{ color: 'var(--color-brand)' }} />} description={`非存量线索·核心获客容量`} showWowChange={false} />
          <MetricCard title="新开户" value={totals.new_opened} valueColor="var(--color-error)" icon={<AimOutlined style={{ color: 'var(--color-error)' }} />} description={`非存量且成功开户人数·主指标`} showWowChange={false} />
          <MetricCard title="新有效户" value={totals.new_valid} valueColor="var(--color-success)" icon={<CheckCircleOutlined style={{ color: 'var(--color-success)' }} />} description={`非存量且有效户人数·主指标`} showWowChange={false} />
          <MetricCard title="新开户资产" value={totals.new_assets} prefix="¥" formatter="currency" valueColor="var(--color-warning)" icon={<DollarOutlined style={{ color: 'var(--color-warning)' }} />} description={`非存量且开户成功客户总资产·主指标`} showWowChange={false} />
        </MetricSection>
        </FadeInSection>

        <FadeInSection delay={0.8} duration={0.8}>
        <MetricSection title="全量主播引流明细" description="含存量客户与资产分项呈现，仅作为辅助参考不取代上方产出指标">
          <MetricCard title="线索量" value={totals.leads} valueColor="var(--color-success)" icon={<UserOutlined style={{ color: 'var(--color-success)' }} />} description={`主播引流客户线索总数（含存量）`} showWowChange={false} />
          <MetricCard title="存量客户" value={totals.existing_leads} valueColor="var(--color-text-tertiary)" icon={<UserOutlined style={{ color: 'var(--color-text-tertiary)' }} />} description={`线索中已在他处开户的存量客户数·辅助指标`} showWowChange={false} />
          <MetricCard title="客户开口" value={totals.mouth} valueColor="var(--chart-color-7)" icon={<RiseOutlined style={{ color: 'var(--chart-color-7)' }} />} description={`线索中已口头回复或沟通的客户`} showWowChange={false} />
          <MetricCard title="有效线索" value={totals.valid_lead} valueColor="var(--chart-color-5)" icon={<RiseOutlined style={{ color: 'var(--chart-color-5)' }} />} description={`已确认有意向的有效线索（含存量）`} showWowChange={false} />
          <MetricCard title="有效线索(剔除存量)" value={totals.new_valid_lead} valueColor="var(--color-brand)" icon={<UserAddOutlined style={{ color: 'var(--color-brand)' }} />} description={`剔除存量客户后的有效线索·核心获客产出`} showWowChange={false} />
          <MetricCard title="存量资产" value={totals.existing_assets} prefix="¥" formatter="currency" valueColor="var(--color-text-tertiary)" icon={<DollarOutlined style={{ color: 'var(--color-text-tertiary)' }} />} description={`存量客户资产·辅助指标（存量客户虽不再开户，但资产仍呈现）`} showWowChange={false} />
        </MetricSection>
        </FadeInSection>

        <FadeInSection delay={1.2} duration={0.8}>
        {/* v3.1.27: 主播引流走势图 (daily/weekly/monthly) */}
        <Card size="small" style={{ marginBottom: 16 }}>
          <Row align="middle" gutter={12} style={{ marginBottom: 12 }}>
            <Col flex="auto">
              <Space size={8} align="center">
                <RiseOutlined style={{ color: 'var(--color-brand)' }} />
                <strong>主播引流走势图</strong>
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

        <FadeInSection delay={1.6} duration={0.8}>
                <Row className={styles.funnelSplitRow}>
          <Col span={12} className={styles.funnelSplitCol}>
            <Card title="6 阶段主播引流业务漏斗" size="small" className={styles.h100Card} extra={<Tooltip title="占比 = 当前阶段人数 ÷ 最大阶段人数（条形长度按比例绘制，已启用对数尺度缓解各级数据偏差）；阶段间百分比 = 上一阶段 → 当前阶段的转化率"><InfoCircleOutlined style={{ color: 'var(--color-text-tertiary)' }} /></Tooltip>}>
              {funnelChartData.length > 0 && funnelChartData[0].count > 0 ? (
                <FunnelChart data={funnelChartData} height={440} useLogScale />
              ) : (
                <Empty description="该日期区间内无主播引流记录" />
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
          <Card title="主播平台对比" size="small" style={{ marginBottom: 16 }}>
            <Table<PlatformRow> size="small" rowKey="platform" dataSource={platformRows} pagination={false} columns={platformColumns as any} scroll={{ x: 'max-content' }} />
          </Card>
        </FadeInSection>

        <FadeInSection delay={2.4} duration={0.8}>
          <Card title={"主播详情（" + anchorAggRows.length + " 位主播·同名跨平台聚合）"} size="small" extra={<span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>按线索量降序{platformFilter.length ? '·已按选中平台筛选' : ''}</span>}>
            {anchorAggRows.length > 0 ? (
              <Table<AnchorAggRow> size="small" rowKey="anchor" dataSource={anchorAggRows} pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 位主播` }} columns={anchorAggColumns as any} scroll={{ x: 'max-content' }} />
            ) : (
              <Empty description={'暂无主播聚类数据（请检查日期区间是否覆盖主播引流时段）'} />
            )}
          </Card>
        </FadeInSection>

        <FadeInSection delay={2.8} duration={0.8}>
          <ReportFooter
            sources={[
              { label: '数据源', value: 'fact_conv_content.客户来源 中“平台引流-主播”模式的记录（如 视频号引流-姚立琦、抖音引流-赵芳、财联社引流-谭记恩）+ dim_anchor_live_type（v3.3.0 新增配置表）' },
              { label: '端点', value: 'POST /api/v1/leads-detail/anchor-clusters' },
              { label: '粒度', value: 'Top 200 主播引流聚合' },
              { label: '存量剔除口径', value: '非存量 = 是否为存量客户==0 OR IS NULL，与 cost_analysis/conversion-funnel/split 一致' },
              { label: '主播聚合', value: '同名主播跨平台聚合（覆盖平台 + 平台数列展开），支持上方平台/直播类型多选筛选' },
              { label: '走势图端点', value: 'POST /api/v1/leads-detail/anchor-clusters-trend（daily/weekly/monthly，v3.3.0 起支持 live_types 过滤）' },
              { label: '走势图口径', value: '同 anchor-clusters：存量客户只贡献存量资产，new_opened/new_valid/new_assets 仅含非存量' },
              { label: '直播类型', value: 'v3.3.0 起 4 类：分析师 / 投顾IP / 投顾配合做带货 / 带货直播，由 dim_anchor_live_type 表按 source_token 映射' },
              { label: '配置入口', value: '系统配置 → 主播直播类型（管理 source_token → 主播名/直播类型 映射）' },
            ]}
            notes={'v3.1.26 起新开户作为核心获客产出：漏斗第 4 阶段起剔除存量客户，「成功开户(新)」「有效户(新)」「新开户资产」为主指标；存量客户线索数与存量资产作为辅助呈现（存量客户已在别处开户，本次引流通常不再开户，但其资产仍统计）。v3.3.0 起新增直播类型筛选与「直播类型」列：主播名通过 dim_anchor_live_type 表归一化（含错字校正，如「直播带货-吴晓字」→ 吴晓宇），同一主播跨 token 涉及多种类型时 primary 取第一个非空、其余放 secondary_live_types。直播明细表数据源未接入（v3.2 待补 观看UV 阶段）；现以主播引流链路作为“直播业务漏斗”替代口径。'}
          />
        </FadeInSection>
      </Spin>
    </div>
  );
};

export default LiveFunnelPage;
