/**
 * 直播类型 · 业务分析报表（通用组件，v3.3.4 参数化）
 *
 * 作为「直播获客」二级报表页，按 liveType prop 过滤，复用同一份代码服务 3 类主播：
 *   - 带货直播 (吴晓宇/杨毅/周乐意) → /live/direct-sales
 *   - 投顾IP (总部投顾 IP 线索) → /live/advisor-ip
 *   - 分析师 (分析师 IP 线索) → /live/analyst
 *
 * 数据源: fact_conv_content.客户来源 中 token 命中 dim_anchor_live_type.live_type=liveType 的记录
 * 端点:   POST /api/v1/leads-detail/anchor-clusters         (主指标 + 主播详情 + breakdown)
 *         POST /api/v1/leads-detail/anchor-clusters-trend     (走势图)
 *
 * 页面结构（参考 Dashboard + Live/Funnel）:
 *   1. 筛选器（日期 / 主播平台 / 主播多选，直播类型固定为 liveType）
 *   2. 核心产出指标卡（5 张：主播数 / 新客户 / 新开户 / 新有效户 / 新开户资产）
 *   3. 主播引流走势图（daily/weekly/monthly 切换）+ 新开户率走势（量质并排）
 *   4. 365 天日历热力图（线索数 / 开户数 / 开户率 切换）
 *   5. 6 阶段业务漏斗 + 阶段转化明细表（整体/按主播 对比）
 *   6. 主播详情表（跨平台聚合 + 质效分级 Tag + expandable token 拆分）
 *   7. 主播产能对比柱图 / 量质剪刀差 / 质效双高日 Top 10
 *   8. ReportFooter
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Row, Col, DatePicker, Space, Spin, Table, Tag, Select, Empty, Tooltip, Segmented } from 'antd';
import {
  ReloadOutlined,
  SearchOutlined,
  VideoCameraOutlined,
  RiseOutlined,
  DollarOutlined,
  InfoCircleOutlined,
  AimOutlined,
  CheckCircleOutlined,
  UserAddOutlined,
  ShoppingCartOutlined,
  BarChartOutlined,
  ScissorOutlined,
  TrophyOutlined,
  BulbOutlined,
  SolutionOutlined,
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

// 4 类直播类型枚举
type LiveType = '分析师' | '投顾IP' | '投顾配合做带货' | '带货直播';

// 各 liveType 的展示配置（颜色 / 图标 / 文案）
const LIVE_TYPE_META: Record<LiveType, {
  color: string;
  icon: React.ReactNode;
  pageTitle: string;       // 浏览器标签 / 面包屑
  anchorLabel: string;     // 主播称谓（如「带货主播」）
  funnelTitle: string;     // 漏斗标题
  descTag: string;         // 顶部 Tag 文案
}> = {
  '带货直播': {
    color: 'magenta',
    icon: <ShoppingCartOutlined />,
    pageTitle: '直播带货 · 业务分析报表',
    anchorLabel: '带货主播',
    funnelTitle: '6 阶段直播带货业务漏斗',
    descTag: '直播类型：带货直播（固定）',
  },
  '投顾IP': {
    color: 'geekblue',
    icon: <SolutionOutlined />,
    pageTitle: '投顾IP · 业务分析报表',
    anchorLabel: '投顾IP主播',
    funnelTitle: '6 阶段投顾IP业务漏斗',
    descTag: '直播类型：投顾IP（固定）',
  },
  '分析师': {
    color: 'purple',
    icon: <BulbOutlined />,
    pageTitle: '分析师 · 业务分析报表',
    anchorLabel: '分析师主播',
    funnelTitle: '6 阶段分析师业务漏斗',
    descTag: '直播类型：分析师（固定）',
  },
  '投顾配合做带货': {
    color: 'gold',
    icon: <ShoppingCartOutlined />,
    pageTitle: '投顾配合做带货 · 业务分析报表',
    anchorLabel: '投顾主播',
    funnelTitle: '6 阶段投顾配合做货业务漏斗',
    descTag: '直播类型：投顾配合做带货（固定）',
  },
};

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

interface DirectSalesPageProps {
  liveType?: LiveType;
}

const DirectSalesPage: React.FC<DirectSalesPageProps> = ({ liveType = '带货直播' }) => {
  const meta = LIVE_TYPE_META[liveType];
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

  // 热力图（固定 daily + 365 天滚动窗口，支持「线索数 / 开户数 / 开户率」切换）
  const [heatmapData, setHeatmapData] = useState<{ date: string; value: number }[]>([]);
  const [heatmapLoading, setHeatmapLoading] = useState(false);
  const [heatmapMetric, setHeatmapMetric] = useState<'new_leads' | 'new_opened' | 'opening_rate'>('new_leads');

  // v3.3.3 P3-8: 质效双高日 Top 10（开户率>5% AND 线索量>10，按开户数降序）
  const [topQualityDays, setTopQualityDays] = useState<
    Array<{ date: string; leads: number; new_opened: number; opening_rate: number; new_assets: number }>
  >([]);
  const [topQualityLoading, setTopQualityLoading] = useState(false);

  const filters = useMemo(() => ({
    start_date: dateRange?.[0]?.format('YYYY-MM-DD'),
    end_date: dateRange?.[1]?.format('YYYY-MM-DD'),
    platforms: platformFilter.length ? platformFilter : undefined,
    // v3.3.4: 固定 live_types = [liveType]，由路由 prop 决定
    live_types: [liveType] as LiveType[],
  }), [dateRange, platformFilter, liveType]);

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
        const arr = Object.entries(res.data.totals).map(([date, v]: [string, any]) => {
          let value: number;
          if (heatmapMetric === 'opening_rate') {
            const opened = Number(v?.new_opened || 0);
            const leads = Number(v?.new_leads || v?.leads || 0);
            value = leads > 0 ? +((opened / leads) * 100).toFixed(2) : 0;
          } else {
            value = Number(v?.[heatmapMetric] || 0);
          }
          return { date, value };
        });
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

  // v3.3.3 P3-8: 质效双高日 Top 10
  const loadTopQualityDays = async () => {
    setTopQualityLoading(true);
    try {
      const res: any = await http.post('/leads-detail/anchor-clusters-trend', {
        filters,
        granularity: 'daily',
      });
      if (res?.success && res.data?.totals) {
        const arr = Object.entries(res.data.totals).map(([date, v]: [string, any]) => {
          const leads = Number(v?.new_leads || v?.leads || 0);
          const new_opened = Number(v?.new_opened || 0);
          const new_assets = Number(v?.new_assets || 0);
          const opening_rate = leads > 0 ? +((new_opened / leads) * 100).toFixed(2) : 0;
          return { date, leads, new_opened, opening_rate, new_assets };
        });
        // 筛选：线索量 > 10 AND 开户率 >= 5% AND 开户数 > 0
        const filtered = arr
          .filter((d) => d.leads > 10 && d.opening_rate >= 5 && d.new_opened > 0)
          .sort((a, b) => b.new_opened - a.new_opened || b.opening_rate - a.opening_rate)
          .slice(0, 10);
        setTopQualityDays(filtered);
      }
    } catch (err) {
      console.warn('direct-sales top-quality-days load failed', err);
    } finally {
      setTopQualityLoading(false);
    }
  };
  useEffect(() => { loadTopQualityDays(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filters]);

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
      series: [...series, totalSeries] as any,
    } as EChartsOption;
  }, [trendData, trendGranularity]);

  // v3.3.3 P0-1: 新开户率走势图 option
  // 新开户率 = new_opened / leads * 100（按平台拆多 series，右图为合计）
  const trendRateOption: EChartsOption = useMemo(() => {
    if (!trendData?.periods?.length || !trendData?.by_platform) return {};
    const periods = trendData.periods as string[];
    const platformsList = (trendData.platforms || []) as string[];
    const by_platform: Record<string, any> = trendData.by_platform;
    const totals: Record<string, any> = trendData.totals || {};
    const rate = (p: string, period: string) => {
      const opened = Number(by_platform?.[period]?.[p]?.new_opened ?? 0);
      const leads = Number(by_platform?.[period]?.[p]?.leads ?? 0);
      return leads > 0 ? +((opened / leads) * 100).toFixed(2) : 0;
    };
    const series = platformsList.map((p, idx) => ({
      name: p,
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      itemStyle: { color: pickEChartsColor(idx) },
      lineStyle: { width: 2 },
      data: periods.map((period) => rate(p, period)),
    }));
    const totalRateSeries = {
      name: '合计新开户率',
      type: 'line',
      smooth: true,
      symbol: 'diamond',
      symbolSize: 8,
      itemStyle: { color: ECHARTS_COLORS[7] },
      lineStyle: { width: 3, type: 'dashed' },
      data: periods.map((p) => {
        const opened = Number(totals[p]?.new_opened ?? 0);
        const leads = Number(totals[p]?.leads ?? 0);
        return leads > 0 ? +((opened / leads) * 100).toFixed(2) : 0;
      }),
    };
    return {
      tooltip: {
        trigger: 'axis',
        valueFormatter: (v: any) => (v == null ? '-' : `${Number(v).toFixed(2)}%`),
      },
      legend: { bottom: 0, type: 'scroll' },
      grid: { left: '3%', right: '4%', bottom: '12%', top: '10%', containLabel: true },
      xAxis: { type: 'category', data: periods, axisLabel: { rotate: trendGranularity === 'daily' ? 30 : 0 } },
      yAxis: [
        {
          type: 'value',
          name: '新开户率(%)',
          axisLabel: { formatter: '{value}%' },
        },
      ],
      series: [...series, totalRateSeries] as any,
    } as EChartsOption;
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

  // v3.3.3 P3-12: 主播详情表 expandable 行展开内容（token 来源拆分）
  const expandedRowRender = (r: AnchorAggRow) => {
    const platforms = r.platforms || [];
    const sources = r.sources || [];
    const allLiveTypes = r.live_types || [];
    const secondaryTypes = r.secondary_live_types || [];
    return (
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        <div>
          <span style={{ color: 'var(--color-text-tertiary)', marginRight: 8, fontSize: 'var(--text-sm)' }}>覆盖平台（{platforms.length}）:</span>
          {platforms.length ? (
            <Space size={[4, 4]} wrap>
              {platforms.map((p) => <Tag key={p} color="cyan">{sanitizeText(p)}</Tag>)}
            </Space>
          ) : <span style={{ color: 'var(--color-text-tertiary)' }}>-</span>}
        </div>
        <div>
          <span style={{ color: 'var(--color-text-tertiary)', marginRight: 8, fontSize: 'var(--text-sm)' }}>直播类型（{allLiveTypes.length}）:</span>
          {allLiveTypes.length ? (
            <Space size={[4, 4]} wrap>
              {allLiveTypes.map((t) => (
                <Tag key={t} color={t === r.live_type ? (LIVE_TYPE_COLOR[t] || 'default') : 'default'}>
                  {t}{t === r.live_type ? ' (主)' : ''}
                </Tag>
              ))}
              {secondaryTypes.length > 0 && (
                <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>
                  · 二级类型 {secondaryTypes.length} 个
                </span>
              )}
            </Space>
          ) : <span style={{ color: 'var(--color-text-tertiary)' }}>未配置</span>}
        </div>
        <div>
          <span style={{ color: 'var(--color-text-tertiary)', marginRight: 8, fontSize: 'var(--text-sm)' }}>
            涉及 token 来源（{sources.length}，去重后）:
          </span>
          {sources.length ? (
            <Space size={[4, 4]} wrap>
              {sources.map((s) => <Tag key={s} color="magenta">{sanitizeText(s)}</Tag>)}
            </Space>
          ) : <span style={{ color: 'var(--color-text-tertiary)' }}>-</span>}
        </div>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', marginTop: 4 }}>
          口径：以上 token 来自 fact_conv_content.客户来源 字段，按 [,，;；、] 分隔后单段，已通过 dim_anchor_live_type 归一化到当前主播名「{r.anchor}」。
        </div>
      </Space>
    );
  };

  // v3.3.3 P0-4: 主播产能对比柱图（横向柱状图，可切换 5 指标）
  const [anchorCompareMetric, setAnchorCompareMetric] = useState<
    'leads' | 'new_opened' | 'new_valid' | 'new_assets' | 'per_lead_assets'
  >('new_opened');
  const anchorCompareOption: EChartsOption = useMemo(() => {
    const metricConfig: Record<string, { name: string; fmt: (r: AnchorAggRow) => number; isCurrency?: boolean; isRate?: boolean }> = {
      leads: { name: '线索量', fmt: (r) => r.leads },
      new_opened: { name: '新开户数', fmt: (r) => r.new_opened },
      new_valid: { name: '新有效户', fmt: (r) => r.new_valid },
      new_assets: { name: '新开户资产', fmt: (r) => Math.round(r.new_assets), isCurrency: true },
      per_lead_assets: { name: '单线索产能', fmt: (r) => (r.leads > 0 ? +(r.new_assets / r.leads).toFixed(0) : 0), isCurrency: true },
    };
    const cfg = metricConfig[anchorCompareMetric];
    const sorted = [...anchorAggRows].sort((a, b) => cfg.fmt(a) - cfg.fmt(b)); // 横向柱图升序，最大在上
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        valueFormatter: (v: any) => {
          if (v == null) return '-';
          if (cfg.isCurrency) return `¥${Number(v).toLocaleString()}`;
          return Number(v).toLocaleString();
        },
      },
      grid: { left: '3%', right: '6%', bottom: '5%', top: '8%', containLabel: true },
      xAxis: {
        type: 'value',
        name: cfg.isCurrency ? '¥' : cfg.name,
        axisLabel: {
          formatter: (v: number) => (cfg.isCurrency ? `${(v / 10000).toFixed(0)}万` : `${v}`),
        },
      },
      yAxis: {
        type: 'category',
        data: sorted.map((r) => r.anchor),
        axisLabel: { fontSize: 12 },
      },
      series: [
        {
          name: cfg.name,
          type: 'bar',
          data: sorted.map((r) => cfg.fmt(r)),
          itemStyle: { color: 'var(--color-brand)' },
          label: {
            show: true,
            position: 'right',
            formatter: (p: any) => {
              const v = p.value as number;
              if (cfg.isCurrency) return `¥${v.toLocaleString()}`;
              return v.toLocaleString();
            },
          },
          barMaxWidth: 24,
        },
      ],
    };
  }, [anchorAggRows, anchorCompareMetric]);

  // v3.3.3 P1-9: 月度量质剪刀差（双 Y 轴：左线索量柱图 + 右开户率折线）
  // 复用 trendData，跟随 trendGranularity；展示「量大质差」或「量质双高」的反向关系
  const scissorOption: EChartsOption = useMemo(() => {
    if (!trendData?.periods?.length || !trendData?.totals) return {};
    const periods = trendData.periods as string[];
    const totals: Record<string, any> = trendData.totals || {};
    const leadsData = periods.map((p) => Number(totals[p]?.new_leads ?? totals[p]?.leads ?? 0));
    const rateData = periods.map((p) => {
      const opened = Number(totals[p]?.new_opened ?? 0);
      const leads = Number(totals[p]?.new_leads ?? totals[p]?.leads ?? 0);
      return leads > 0 ? +((opened / leads) * 100).toFixed(2) : 0;
    });
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        formatter: (params: any) => {
          if (!Array.isArray(params) || !params.length) return '';
          const title = params[0].axisValueLabel;
          const lines = [title];
          params.forEach((p: any) => {
            const val = p.seriesName === '新开户率'
              ? `${Number(p.value).toFixed(2)}%`
              : Number(p.value).toLocaleString();
            lines.push(`${p.marker} ${p.seriesName}: ${val}`);
          });
          return lines.join('<br/>');
        },
      },
      legend: { bottom: 0, type: 'scroll' },
      grid: { left: '3%', right: '6%', bottom: '12%', top: '12%', containLabel: true },
      xAxis: { type: 'category', data: periods, axisLabel: { rotate: trendGranularity === 'daily' ? 30 : 0 } },
      yAxis: [
        {
          type: 'value',
          name: '新客户线索量',
          position: 'left',
          axisLine: { show: true, lineStyle: { color: pickEChartsColor(0) } },
          axisLabel: { formatter: '{value}' },
        },
        {
          type: 'value',
          name: '新开户率(%)',
          position: 'right',
          axisLine: { show: true, lineStyle: { color: ECHARTS_COLORS[7] } },
          axisLabel: { formatter: '{value}%' },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: '新客户线索量',
          type: 'bar',
          yAxisIndex: 0,
          data: leadsData,
          itemStyle: { color: pickEChartsColor(0), opacity: 0.75 },
          barMaxWidth: 40,
        },
        {
          name: '新开户率',
          type: 'line',
          yAxisIndex: 1,
          smooth: true,
          symbol: 'circle',
          symbolSize: 8,
          itemStyle: { color: ECHARTS_COLORS[7] },
          lineStyle: { width: 3 },
          data: rateData,
          label: {
            show: true,
            position: 'top',
            formatter: (p: any) => `${Number(p.value).toFixed(2)}%`,
          },
        },
      ],
    };
  }, [trendData, trendGranularity]);

  // v3.3.3 P3-11: 漏斗对比模式（整体 FunnelChart / 按主播 堆叠柱图）
  const [funnelMode, setFunnelMode] = useState<'overall' | 'by_anchor'>('overall');
  const funnelByAnchorOption: EChartsOption = useMemo(() => {
    if (!anchorAggRows.length) return {};
    const stages = [
      { key: 'leads', label: '客户线索' },
      { key: 'mouth', label: '客户开口' },
      { key: 'valid_lead', label: '有效线索' },
      { key: 'new_valid_lead', label: '有效(非存量)' },
      { key: 'new_opened', label: '成功开户(新)' },
      { key: 'new_valid', label: '有效户(新)' },
    ] as const;
    const rows = [...anchorAggRows].sort((a, b) => b.leads - a.leads);
    const series = rows.map((r, idx) => ({
      name: r.anchor,
      type: 'bar',
      stack: 'anchor',
      itemStyle: { color: pickEChartsColor(idx) },
      barMaxWidth: 60,
      data: stages.map((s) => Number((r as any)[s.key] || 0)),
    }));
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        valueFormatter: (v: any) => Number(v || 0).toLocaleString(),
      },
      legend: { bottom: 0, type: 'scroll' },
      grid: { left: '3%', right: '4%', bottom: '12%', top: '10%', containLabel: true },
      xAxis: {
        type: 'category',
        data: stages.map((s) => s.label),
        axisLabel: { fontSize: 11, interval: 0, rotate: 0 },
      },
      yAxis: { type: 'value', name: '人数' },
      series: series as any,
    } as EChartsOption;
  }, [anchorAggRows]);

  const anchorAggColumns = [
    { title: '主播', dataIndex: 'anchor', width: 130, fixed: 'left' as const, render: (v: string) => <strong>{sanitizeText(v)}</strong> },
    {
      title: '质效分级',
      key: 'quality_grade',
      width: 110,
      align: 'center' as const,
      render: (_: any, r: AnchorAggRow) => {
        const leads = r.leads || 0;
        const rate = r.opening_rate || 0;
        if (leads < 50) {
          return <Tooltip title={`线索量 ${leads} < 50，样本不足，不评级`}><Tag color="default">待观察</Tag></Tooltip>;
        }
        if (rate >= 5) {
          return <Tooltip title={`开户率 ${rate.toFixed(2)}% ≥ 5%，量大质优·核心产能`}><Tag color="green">高质效</Tag></Tooltip>;
        }
        if (rate >= 1) {
          return <Tooltip title={`开户率 ${rate.toFixed(2)}% 处于 1-5%，中等水平`}><Tag color="gold">中质效</Tag></Tooltip>;
        }
        return <Tooltip title={`开户率 ${rate.toFixed(2)}% < 1%，量大质差·需优化转化`}><Tag color="red">低质效</Tag></Tooltip>;
      },
    },
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
    { title: '线索数', dataIndex: 'new_leads', align: 'right' as const, width: 90, render: (v: number) => v.toLocaleString() },
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
              placeholder={`全部${meta.anchorLabel}`}
              value={anchorFilter}
              onChange={(v) => setAnchorFilter(v as string[])}
              options={anchorOptions.map((a) => ({ label: a, value: a }))}
              style={{ minWidth: 220 }}
              maxTagCount="responsive"
              filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())}
            />
            <Tag color={meta.color} style={{ marginLeft: 4 }}>{meta.descTag}</Tag>
            <Button type="primary" icon={<SearchOutlined />} onClick={load}>查询</Button>
            <Button icon={<ReloadOutlined />} onClick={resetFilters}>重置</Button>
          </Space>
        </Card>
      </FadeInSection>

      <Spin spinning={loading}>
        <FadeInSection delay={0.4} duration={0.8}>
          <MetricSection title={`${liveType}核心产出`} description={`${meta.anchorLabel}的新客户获客主指标（仅统计非存量客户）`}>
            <MetricCard title={`${meta.anchorLabel}数`} value={totals.anchors} valueColor="var(--color-brand)" icon={React.cloneElement(meta.icon as React.ReactElement<any>, { style: { color: 'var(--color-brand)' } } as any)} description={`直播类型=${liveType}的主播数`} showWowChange={false} />
            <MetricCard title="线索数" value={totals.new_leads} valueColor="var(--color-brand)" icon={<UserAddOutlined style={{ color: 'var(--color-brand)' }} />} description={`非存量线索·核心获客容量`} showWowChange={false} />
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
                  <strong>{meta.anchorLabel}量质走势</strong>
                  <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>
                    按 {trendData?.granularity || 'monthly'} 口径汇总 · 左：新开户数(量) · 右：新开户率(质)
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
            <Row gutter={12}>
              <Col xs={24} lg={12}>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                  <UserAddOutlined style={{ color: 'var(--color-brand)' }} /> 新开户数走势（量）
                </div>
                {trendData?.periods?.length ? (
                  <EChartsComponent option={trendOption} height={300} loading={trendLoading} />
                ) : (
                  <Empty description={trendLoading ? '加载中...' : '暂无走势数据'} />
                )}
              </Col>
              <Col xs={24} lg={12}>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                  <RiseOutlined style={{ color: 'var(--color-success)' }} /> 新开户率走势（质 = 新开户 ÷ 线索）
                </div>
                {trendData?.periods?.length ? (
                  <EChartsComponent option={trendRateOption} height={300} loading={trendLoading} />
                ) : (
                  <Empty description={trendLoading ? '加载中...' : '暂无走势数据'} />
                )}
              </Col>
            </Row>
          </Card>
        </FadeInSection>

        <FadeInSection delay={1.0} duration={0.8}>
          <Card
            size="small"
            style={{ marginBottom: 16 }}
            title={
              <Space size={8} align="center">
                <BarChartOutlined style={{ color: 'var(--color-brand)' }} />
                <span>主播产能对比</span>
                <Tooltip title={`横向柱图对比${meta.anchorLabel}的核心产出指标。可切换 5 个指标；最大值在顶部。`}>
                  <InfoCircleOutlined style={{ color: 'var(--color-text-tertiary)' }} />
                </Tooltip>
              </Space>
            }
            extra={
              <Segmented
                size="small"
                value={anchorCompareMetric}
                onChange={(v) => setAnchorCompareMetric(v as typeof anchorCompareMetric)}
                options={[
                  { label: '线索量', value: 'leads' },
                  { label: '新开户', value: 'new_opened' },
                  { label: '新有效户', value: 'new_valid' },
                  { label: '新开户资产', value: 'new_assets' },
                  { label: '单线索产能', value: 'per_lead_assets' },
                ]}
              />
            }
          >
            {anchorAggRows.length > 0 ? (
              <EChartsComponent option={anchorCompareOption} height={Math.max(220, anchorAggRows.length * 60 + 60)} />
            ) : (
              <Empty description={'暂无主播数据'} />
            )}
          </Card>
        </FadeInSection>

        <FadeInSection delay={1.1} duration={0.8}>
          <Card
            size="small"
            style={{ marginBottom: 16 }}
            title={
              <Space size={8} align="center">
                <ScissorOutlined style={{ color: 'var(--color-error)' }} />
                <span>量质剪刀差</span>
                <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>
                  柱：新客户线索量(量) · 线：新开户率(质) · 反向关系暴露「量大质差」/「量质双高」
                </span>
                <Tooltip title="左轴线索量越大表示吸引越多人；右轴开户率越高表示转化越有效。两线背离时说明量大质差，常出现于 6·18 / 双 11 / 大促节点后。">
                  <InfoCircleOutlined style={{ color: 'var(--color-text-tertiary)' }} />
                </Tooltip>
              </Space>
            }
          >
            {trendData?.periods?.length ? (
              <EChartsComponent option={scissorOption} height={320} loading={trendLoading} />
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
                <span>365 天{meta.anchorLabel}日历</span>
                <Tooltip title="滚动 365 天窗口；颜色越深表示当日数量越多，便于发现直播节奏。开户数通常较少（转化率 1-5%），可切到「线索数」查看更丰富的热力分布">
                  <InfoCircleOutlined style={{ color: 'var(--color-text-tertiary)' }} />
                </Tooltip>
              </Space>
            }
            extra={
              <Segmented
                size="small"
                value={heatmapMetric}
                onChange={(v) => setHeatmapMetric(v as 'new_leads' | 'new_opened' | 'opening_rate')}
                options={[
                  { label: '线索数', value: 'new_leads' },
                  { label: '开户数', value: 'new_opened' },
                  { label: '开户率', value: 'opening_rate' },
                ]}
              />
            }
          >
            <CalendarHeatmap data={heatmapData} loading={heatmapLoading} days={365} preferredCellSize={16} />
          </Card>
        </FadeInSection>

        <FadeInSection delay={1.6} duration={0.8}>
          <Row className={styles.funnelSplitRow}>
            <Col span={12} className={styles.funnelSplitCol}>
              <Card
                title={meta.funnelTitle}
                size="small"
                className={styles.h100Card}
                extra={
                  <Space size={8}>
                    <Segmented
                      size="small"
                      value={funnelMode}
                      onChange={(v) => setFunnelMode(v as 'overall' | 'by_anchor')}
                      options={[
                        { label: '整体', value: 'overall' },
                        { label: '按主播', value: 'by_anchor' },
                      ]}
                    />
                    <Tooltip title={funnelMode === 'overall' ? '占比 = 当前阶段人数 ÷ 最大阶段人数（条形长度按比例绘制，已启用对数尺度缓解各级数据偏差）；阶段间百分比 = 上一阶段 → 当前阶段的转化率' : '横轴 6 阶段，3 位主播叠加柱图对比各阶段贡献。'}>
                      <InfoCircleOutlined style={{ color: 'var(--color-text-tertiary)' }} />
                    </Tooltip>
                  </Space>
                }
              >
                {funnelMode === 'overall' ? (
                  funnelChartData.length > 0 && funnelChartData[0].count > 0 ? (
                    <FunnelChart data={funnelChartData} height={440} useLogScale />
                  ) : (
                    <Empty description={`该日期区间内无${meta.anchorLabel}引流记录`} />
                  )
                ) : (
                  anchorAggRows.length > 0 ? (
                    <EChartsComponent option={funnelByAnchorOption} height={440} />
                  ) : (
                    <Empty description={`该日期区间内无${meta.anchorLabel}引流记录`} />
                  )
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
          <Card title={`${meta.anchorLabel}详情（${anchorAggRows.length} 位主播·同名跨平台聚合）`} size="small" extra={<span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>按线索量降序</span>}>
            {anchorAggRows.length > 0 ? (
              <Table<AnchorAggRow> size="small" rowKey="anchor" dataSource={anchorAggRows} pagination={false} columns={anchorAggColumns as any} scroll={{ x: 'max-content' }} expandable={{ expandedRowRender, rowExpandable: (r) => (r.sources?.length || 0) > 0 }} />
            ) : (
              <Empty description={`暂无${meta.anchorLabel}数据（请检查日期区间是否覆盖${liveType}时段）`} />
            )}
          </Card>
        </FadeInSection>

        <FadeInSection delay={2.3} duration={0.8}>
          <Card
            size="small"
            style={{ marginBottom: 16 }}
            title={
              <Space size={8} align="center">
                <TrophyOutlined style={{ color: 'var(--color-warning)' }} />
                <span>质效双高日 Top 10</span>
                <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>
                  筛选：线索量 &gt; 10 且 新开户率 ≥ 5% · 按新开户数降序
                </span>
                <Tooltip title="用于发现「量质双优」的日期，可能对应优质直播场次或有效营销策略。可对比主播当日的开播节奏、内容选题，复制成功经验。">
                  <InfoCircleOutlined style={{ color: 'var(--color-text-tertiary)' }} />
                </Tooltip>
              </Space>
            }
          >
            <Spin spinning={topQualityLoading}>
              {topQualityDays.length > 0 ? (
                <Table
                  size="small"
                  rowKey="date"
                  dataSource={topQualityDays}
                  pagination={false}
                  scroll={{ x: 'max-content' }}
                  columns={[
                    { title: '#', width: 50, align: 'center' as const, render: (_: any, __: any, idx: number) => <Tag color={idx < 3 ? 'gold' : 'default'}>{idx + 1}</Tag> },
                    { title: '日期', dataIndex: 'date', width: 120, render: (v: string) => <strong>{sanitizeText(v)}</strong> },
                    { title: '线索量', dataIndex: 'leads', align: 'right' as const, width: 100, render: (v: number) => v.toLocaleString() },
                    { title: '新开户数', dataIndex: 'new_opened', align: 'right' as const, width: 100, render: (v: number) => <strong style={{ color: 'var(--color-error)' }}>{v}</strong> },
                    { title: '新开户率', dataIndex: 'opening_rate', align: 'right' as const, width: 110, render: (v: number) => <Tag color={v >= 10 ? 'green' : 'gold'}>{v.toFixed(2)}%</Tag> },
                    { title: '新开户资产', dataIndex: 'new_assets', align: 'right' as const, width: 140, render: (v: number) => v ? `¥${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '-' },
                  ]}
                />
              ) : (
                <Empty description={topQualityLoading ? '加载中...' : '当前日期范围内无质效双高日（线索量>10 且 开户率≥5%）'} />
              )}
            </Spin>
          </Card>
        </FadeInSection>

        <FadeInSection delay={2.4} duration={0.8}>
          <ReportFooter
            sources={[
              { label: '数据源', value: `fact_conv_content.客户来源 中 token 命中 dim_anchor_live_type.live_type='${liveType}' 的记录` },
              { label: '端点', value: `POST /api/v1/leads-detail/anchor-clusters（filters.live_types=['${liveType}']）` },
              { label: '存量剔除', value: '非存量 = 是否为存量客户==0 OR IS NULL' },
              { label: '主播聚合', value: '同名主播跨平台聚合，支持上方主播平台/主播多选筛选' },
              { label: '配置方式', value: 'backend/config/anchor_live_types.json（JSON 权威源，启动时自动 upsert 到 DB）' },
            ]}
            notes={`${meta.anchorLabel}专项报表：直播类型固定为「${liveType}」，新开户作为核心获客产出指标。漏斗第 4 阶段起剔除存量客户，质效分级与质效双高日用于辅助识别优质主播与节点。`}
          />
        </FadeInSection>
      </Spin>
    </div>
  );
};

export default DirectSalesPage;
