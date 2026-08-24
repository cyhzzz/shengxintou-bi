/**
 * 应用市场 · 广告计划分析 (v3.8.2)
 *
 * 业务定位：
 *   结合三个数据源做广告计划维度的获客与成本分析：
 *   1. 应用市场计划分解 (dim_ad_plan_class) —— 计划的分类维度（版位/子版位/出价）
 *   2. 应用市场下载链路 (fact_conv_appmarket) —— 各计划下载链路各阶段（去重设备号）
 *   3. 厂商广告投放分析 (agg_vendor_daily) —— 各计划的消耗/展示/点击（花费）
 *
 * 页面结构（周度口径统一：上周五 → 本周四）：
 *   一、筛选器（应用市场多选 + 全部 + 日期范围，默认全部）
 *   二、开户概览（总开户 / 总消耗 / 总开户成本）
 *   三、按周开户量柱状图（每周广告开户量，图上显示数值）
 *   四、按周分计划分析（周度筛选，各计划按该周消耗降序，含完整漏斗指标）
 *   五、广告聚类分析（周度筛选：版位 / 子版位 / 版位+子版位 / 出价 × 消耗 / 广告开户量 / 广告开户成本）
 *   六、分计划分析（每条计划一个模块：汇总数据 + 「+」按周展开逐周明细）
 *   七、计划分析（按计划明细 / 版位 / 市场聚合）
 *   八、ReportFooter
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Card, Select, Space, Spin, Table, Button, Tooltip, Empty, message, Collapse, Tag, Tabs } from 'antd';
import {
  DownloadOutlined, ReloadOutlined,
  UserAddOutlined, MoneyCollectOutlined, FundOutlined,
  AppstoreOutlined, CalendarOutlined, BarsOutlined, ApartmentOutlined,
} from '@ant-design/icons';
import EChartsComponent from '@/components/Chart/ECharts';
import type { EChartsOption } from 'echarts';
import { pickEChartsColor } from '@/utils/echartsColors';
import { dataServiceReports } from '@/services/dataService';
import { MetricCard, MetricSection } from '@/components/MetricCard';
import { ReportFooter } from '@/components/ReportFooter';
import { FadeInSection, FilterBar } from '@/components';
import { sanitizeText } from '@/utils/sanitizeText';
import { useFilterStore } from '@/stores';
import styles from './index.module.scss';

interface PlanDetailRow {
  plan_id: string;
  market: string;
  plan_name: string;
  placement: string;
  sub_placement: string;
  bid: string;
  open_count: number;
  spend: number;
  open_cost: number | null;
}

interface AggRow {
  market?: string;
  placement?: string;
  sub_placement?: string;
  open_count: number;
  spend: number;
  open_cost: number | null;
}

interface Overview {
  total_open: number;
  total_spend: number;
  total_open_cost: number | null;
}

interface WeeklyOpenPoint {
  market?: string;
  week_start: string;
  week_end: string;
  open_count: number;
}

interface ClusterRow {
  dim: string;
  消耗: number;
  广告开户量: number;
  广告开户成本: number | null;
}

interface FunnelMetrics {
  消耗: number;
  展示: number;
  点击: number;
  点击率: number;
  下载量: number;
  下载率: number;
  激活量: number;
  激活率: number;
  开户注册量: number;
  开户注册率: number;
  身份证上传量: number;
  身份证上传率: number;
  银行卡上传量: number;
  银行卡上传率: number;
  开户提交量: number;
  开户提交率: number;
  开户成功量: number;
  开户成功率: number;
  广告开户量: number;
  广告开户率: number;
  广告开户成本: number | null;
}

interface PlanWeekRow extends FunnelMetrics {
  week_start: string;
  week_end: string;
}

interface PlanWeekDetail {
  plan_id: string;
  market: string;
  plan_name: string;
  placement: string;
  sub_placement: string;
  bid: string;
  summary: FunnelMetrics;
  weeks: PlanWeekRow[];
}

// ---- 模块级工具：格式化 + 共享漏斗列（供 按周分计划 / 分计划 复用） ----
const fmtMoney = (v: number | null | undefined) =>
  v == null ? '-' : `¥${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtPct = (v: number | null | undefined) =>
  v == null ? '-' : `${(Number(v) * 100).toFixed(2)}%`;
const fmtNum = (v: number | null | undefined) =>
  v == null ? '-' : Number(v).toLocaleString();

const weekLabel = (ws: string, we?: string) => {
  const end = we;
  if (end) return `${ws.slice(5)}~${end.slice(5)}`;
  const d = new Date(`${ws}T00:00:00`);
  d.setDate(d.getDate() + 6);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${ws.slice(5)}~${mm}-${dd}`;
};

const METRIC_COLS: { key: keyof FunnelMetrics; title: string; kind: 'money' | 'num' | 'pct' }[] = [
  { key: '消耗', title: '消耗', kind: 'money' },
  { key: '展示', title: '展示', kind: 'num' },
  { key: '点击', title: '点击', kind: 'num' },
  { key: '点击率', title: '点击率', kind: 'pct' },
  { key: '下载量', title: '下载量', kind: 'num' },
  { key: '下载率', title: '下载率', kind: 'pct' },
  { key: '激活量', title: '激活量', kind: 'num' },
  { key: '激活率', title: '激活率', kind: 'pct' },
  { key: '开户注册量', title: '开户注册量', kind: 'num' },
  { key: '开户注册率', title: '开户注册率', kind: 'pct' },
  { key: '身份证上传量', title: '身份证上传量', kind: 'num' },
  { key: '身份证上传率', title: '身份证上传率', kind: 'pct' },
  { key: '银行卡上传量', title: '银行卡上传量', kind: 'num' },
  { key: '银行卡上传率', title: '银行卡上传率', kind: 'pct' },
  { key: '开户提交量', title: '开户提交量', kind: 'num' },
  { key: '开户提交率', title: '开户提交率', kind: 'pct' },
  { key: '开户成功量', title: '开户成功量', kind: 'num' },
  { key: '开户成功率', title: '开户成功率', kind: 'pct' },
  { key: '广告开户量', title: '广告开户量', kind: 'num' },
  { key: '广告开户率', title: '广告开户率', kind: 'pct' },
  { key: '广告开户成本', title: '广告开户成本', kind: 'money' },
];

const funnelMetricColumns = METRIC_COLS.map((c) => ({
  title: c.title,
  key: c.key,
  dataIndex: c.key,
  align: 'right' as const,
  width: 112,
  sorter: (a: FunnelMetrics, b: FunnelMetrics) => (Number(a[c.key]) || 0) - (Number(b[c.key]) || 0),
  render: (v: unknown) => (c.kind === 'money' ? fmtMoney(v as number | null) : c.kind === 'pct' ? fmtPct(v as number | null) : fmtNum(v as number | null)),
}));

const weekPlanColumns = [
  {
    title: '计划',
    key: 'plan_name',
    width: 240,
    fixed: 'left' as const,
    ellipsis: true,
    render: (_: unknown, r: PlanWeekRow & { market: string; plan_name: string }) => (
      <Space size={6}>
        <Tag color="blue">{sanitizeText(r.market)}</Tag>
        <span>{sanitizeText(r.plan_name)}</span>
      </Space>
    ),
  },
  ...funnelMetricColumns,
];

const weekRowsColumns = [
  { title: '周（上周五~本周四）', key: 'week', width: 150, fixed: 'left' as const, render: (_: unknown, r: PlanWeekRow) => weekLabel(r.week_start, r.week_end) },
  ...funnelMetricColumns,
];

const clusterColumns = [
  { title: '维度', key: 'dim', dataIndex: 'dim', width: 220, fixed: 'left' as const, ellipsis: true, render: (v: string) => sanitizeText(v) },
  {
    title: '消耗', key: '消耗', dataIndex: '消耗', align: 'right' as const, width: 140,
    sorter: (a: ClusterRow, b: ClusterRow) => a['消耗'] - b['消耗'],
    render: (v: number) => <span style={{ color: 'var(--color-error)' }}>{fmtMoney(v)}</span>,
  },
  {
    title: '广告开户量', key: '广告开户量', dataIndex: '广告开户量', align: 'right' as const, width: 130,
    sorter: (a: ClusterRow, b: ClusterRow) => a['广告开户量'] - b['广告开户量'],
    render: (v: number) => <strong style={{ color: 'var(--color-brand)' }}>{fmtNum(v)}</strong>,
  },
  {
    title: '广告开户成本', key: '广告开户成本', dataIndex: '广告开户成本', align: 'right' as const, width: 150,
    sorter: (a: ClusterRow, b: ClusterRow) => (a['广告开户成本'] || 0) - (b['广告开户成本'] || 0),
    render: (v: number | null) => fmtMoney(v),
  },
];

const clusterTabItems = (data: Record<string, ClusterRow[]>) => [
  { key: 'placement', label: '版位分析', children: <Table<ClusterRow> size="small" rowKey="dim" dataSource={data.by_placement} columns={clusterColumns} pagination={false} scroll={{ x: 'max-content' }} /> },
  { key: 'sub', label: '子版位分析', children: <Table<ClusterRow> size="small" rowKey="dim" dataSource={data.by_sub_placement} columns={clusterColumns} pagination={false} scroll={{ x: 'max-content' }} /> },
  { key: 'both', label: '版位+子版位', children: <Table<ClusterRow> size="small" rowKey="dim" dataSource={data.by_placement_sub} columns={clusterColumns} pagination={false} scroll={{ x: 'max-content' }} /> },
  { key: 'bid', label: '出价分析', children: <Table<ClusterRow> size="small" rowKey="dim" dataSource={data.by_bid} columns={clusterColumns} pagination={false} scroll={{ x: 'max-content' }} /> },
];

// 与后端 ALLOWED_PLATFORMS 对齐：首屏默认全选，避免初次加载前 Select 为空的闪烁
const INITIAL_MARKETS = ['oppo', 'vivo', '荣耀', '小米', '华为', '鸿蒙', '苹果'];

const AppMarketAdPlanAnalysisPage: React.FC = () => {
  const [markets, setMarkets] = useState<string[]>(INITIAL_MARKETS);
  const [selected, setSelected] = useState<string[]>(INITIAL_MARKETS);
  const [overview, setOverview] = useState<Overview>({ total_open: 0, total_spend: 0, total_open_cost: null });
  const [planDetail, setPlanDetail] = useState<PlanDetailRow[]>([]);
  const [byMarket, setByMarket] = useState<AggRow[]>([]);
  const [weeklyOpen, setWeeklyOpen] = useState<WeeklyOpenPoint[]>([]);
  const [weeks, setWeeks] = useState<string[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string | undefined>(undefined);
  const [clusterWeek, setClusterWeek] = useState<string | undefined>(undefined);
  const [planWeekDetail, setPlanWeekDetail] = useState<PlanWeekDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const { dateRange } = useFilterStore();

  const load = async () => {
    setLoading(true);
    try {
      // 始终请求全量（7 大市场）的数据作为客户端缓存，应用市场筛选在本地进行
      // —— 避免每次切换市场触发 8s 的 plan_week_analysis 重查，做到 Select 即时响应。
      const res: any = await dataServiceReports.getAppMarketAdPlanAnalysis({
        filters: {
          platforms: [],
          start_date: dateRange.startDate,
          end_date: dateRange.endDate,
        },
      });
      if (res?.success) {
        const d = res.data || {};
        setMarkets(d.platforms || INITIAL_MARKETS);
        setOverview(d.overview || { total_open: 0, total_spend: 0, total_open_cost: null });
        setPlanDetail(d.plan_detail || []);
        setByMarket(d.by_market || []);
        setWeeklyOpen(d.weekly_open || []);
        setWeeks(d.weeks || []);
        setSelectedWeek(d.selected_week || undefined);
        setClusterWeek(d.selected_week || undefined);
        setPlanWeekDetail(d.plan_week_detail || []);
      } else {
        message.error(res?.message || '加载失败');
      }
    } catch (_e) {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  // 仅日期范围变化触发重查；应用市场切换完全本地过滤（瞬时响应）
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange.startDate, dateRange.endDate]);

  const resetFilters = () => {
    setSelected(markets.length ? markets : INITIAL_MARKETS);
  };

  // ---- 应用市场筛选集合（去除重复/已不存在的市场） ----
  const activeMarkets = useMemo(() => {
    const set = new Set<string>();
    for (const m of selected) if (markets.includes(m)) set.add(m);
    return set;
  }, [selected, markets]);

  // ---- 概览（市场级：按 selected 汇总 by_market） ----
  const displayedOverview: Overview = useMemo(() => {
    if (!byMarket.length) return overview;
    let open = 0, spend = 0;
    for (const m of byMarket) if (m.market && activeMarkets.has(m.market)) { open += m.open_count; spend += m.spend; }
    spend = Math.round(spend * 100) / 100;
    return { total_open: open, total_spend: spend, total_open_cost: open ? Math.round(spend / open * 100) / 100 : null };
  }, [byMarket, activeMarkets, overview]);

  // ---- 按应用市场聚合：过滤 by_market ----
  const displayedByMarket: AggRow[] = useMemo(
    () => byMarket.filter((m) => m.market && activeMarkets.has(m.market)).sort((a, b) => (b.open_count || 0) - (a.open_count || 0)),
    [byMarket, activeMarkets],
  );

  // ---- 按计划明细：过滤 plan_detail ----
  const displayedPlanDetail: PlanDetailRow[] = useMemo(
    () => planDetail.filter((p) => activeMarkets.has(p.market)).sort((a, b) => (b.open_count || 0) - (a.open_count || 0)),
    [planDetail, activeMarkets],
  );

  // ---- 按版位/子版位聚合：由筛选后的 plan_detail 重算 ----
  const displayedByPlacement: AggRow[] = useMemo(() => {
    const map = new Map<string, AggRow>();
    for (const p of displayedPlanDetail) {
      const key = `${p.placement || '未分类'}__${p.sub_placement || '未分类'}`;
      const cur = map.get(key) || { placement: p.placement, sub_placement: p.sub_placement, open_count: 0, spend: 0, open_cost: null };
      cur.open_count += p.open_count;
      cur.spend = Math.round(((cur.spend || 0) + p.spend) * 100) / 100;
      map.set(key, cur);
    }
    const list = [...map.values()];
    for (const r of list) r.open_cost = r.open_count ? Math.round(r.spend / r.open_count * 100) / 100 : null;
    return list.sort((a, b) => (b.open_count || 0) - (a.open_count || 0));
  }, [displayedPlanDetail]);

  // ---- 按周开户量（柱状图）：weekly_open 是 per-market，按 activeMarkets 周内求和 ----
  const displayedWeeklyOpen: WeeklyOpenPoint[] = useMemo(() => {
    if (!weeklyOpen.length) return [];
    const acc = new Map<string, { week_start: string; week_end: string; open_count: number }>();
    for (const w of weeklyOpen) {
      if (!w.market || !activeMarkets.has(w.market)) continue;
      const e = acc.get(w.week_start) || { week_start: w.week_start, week_end: w.week_end, open_count: 0 };
      e.open_count += w.open_count;
      acc.set(w.week_start, e);
    }
    return [...acc.values()].sort((a, b) => (a.week_start > b.week_start ? 1 : -1));
  }, [weeklyOpen, activeMarkets]);

  // ---- 分计划展开（按所选应用市场筛选） ----
  const displayedPlanWeekDetail: PlanWeekDetail[] = useMemo(
    () => planWeekDetail.filter((p) => activeMarkets.has(p.market)),
    [planWeekDetail, activeMarkets],
  );

  // ---- 按周分计划分析：由 displayedPlanWeekDetail 按所选周派生 ----
  const selectedWeekPlans = useMemo(() => {
    if (!selectedWeek) return [];
    const rows: (PlanWeekRow & { market: string; plan_name: string })[] = [];
    for (const pl of displayedPlanWeekDetail) {
      const w = pl.weeks.find((x) => x.week_start === selectedWeek);
      if (w) rows.push({ market: pl.market, plan_name: pl.plan_name, ...w });
    }
    rows.sort((a, b) => (b['消耗'] || 0) - (a['消耗'] || 0));
    return rows;
  }, [displayedPlanWeekDetail, selectedWeek]);

  // ---- 广告聚类分析：由 displayedPlanWeekDetail 按所选周派生 ----
  const clusterData = useMemo(() => {
    const empty = { by_placement: [], by_sub_placement: [], by_placement_sub: [], by_bid: [] } as Record<string, ClusterRow[]>;
    if (!clusterWeek) return empty;
    const mPlace = new Map<string, { spend: number; open: number }>();
    const mSub = new Map<string, { spend: number; open: number }>();
    const mBoth = new Map<string, { spend: number; open: number }>();
    const mBid = new Map<string, { spend: number; open: number }>();
    const push = (m: Map<string, { spend: number; open: number }>, key: string, spend: number, open: number) => {
      const e = m.get(key) || { spend: 0, open: 0 };
      e.spend += spend;
      e.open += open;
      m.set(key, e);
    };
    for (const pl of displayedPlanWeekDetail) {
      const w = pl.weeks.find((x) => x.week_start === clusterWeek);
      if (!w) continue;
      const spend = w['消耗'] || 0;
      const open = w['广告开户量'] || 0;
      const place = pl.placement || '未分类';
      const sub = pl.sub_placement || '未分类';
      push(mPlace, place, spend, open);
      push(mSub, sub, spend, open);
      push(mBoth, `${place} / ${sub}`, spend, open);
      push(mBid, pl.bid || '未设置', spend, open);
    }
    const toArr = (m: Map<string, { spend: number; open: number }>): ClusterRow[] =>
      [...m.entries()]
        .map(([dim, v]) => ({
          dim,
          消耗: Math.round(v.spend * 100) / 100,
          广告开户量: v.open,
          广告开户成本: v.open ? Math.round((v.spend / v.open) * 100) / 100 : null,
        }))
        .sort((a, b) => (b['消耗'] || 0) - (a['消耗'] || 0));
    return {
      by_placement: toArr(mPlace),
      by_sub_placement: toArr(mSub),
      by_placement_sub: toArr(mBoth),
      by_bid: toArr(mBid),
    };
  }, [displayedPlanWeekDetail, clusterWeek]);

  // ---- 按周开户量柱状图（上周五~本周四，图上显示数值；数据来自客户端筛选后的 displayedWeeklyOpen） ----
  const openChartOption: EChartsOption = useMemo(() => {
    if (!displayedWeeklyOpen.length) return {};
    const labels = displayedWeeklyOpen.map((w) => weekLabel(w.week_start, w.week_end));
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          const i = params?.[0]?.dataIndex ?? -1;
          const w = displayedWeeklyOpen[i];
          if (!w) return '';
          return `${w.week_start} ~ ${w.week_end}<br/>开户量：<strong>${w.open_count.toLocaleString()}</strong>`;
        },
      },
      grid: { left: '3%', right: '4%', bottom: '14%', top: '10%', containLabel: true },
      xAxis: { type: 'category', data: labels, axisLabel: { rotate: 30, fontSize: 11 } },
      yAxis: [{ type: 'value', name: '开户量' }],
      series: [
        {
          name: '开户量',
          type: 'bar',
          data: displayedWeeklyOpen.map((w) => w.open_count),
          itemStyle: { color: pickEChartsColor(0), opacity: 0.85, borderRadius: [4, 4, 0, 0] },
          barMaxWidth: 42,
          label: { show: true, position: 'top', fontSize: 11, formatter: (p: any) => Number(p.value || 0).toLocaleString() },
        },
      ],
    };
  }, [displayedWeeklyOpen]);

  const exportPlanCsv = () => {
    if (!displayedPlanDetail.length) return;
    const headers = ['应用市场', '广告分组ID', '广告分组名称', '版位', '子版位', '出价', '开户数', '消耗', '开户成本'];
    const rows = displayedPlanDetail.map((p) => [
      p.market, p.plan_id, p.plan_name, p.placement, p.sub_placement, p.bid,
      p.open_count, p.spend, p.open_cost == null ? '' : p.open_cost,
    ].join(','));
    const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `广告计划分析_${selected.length ? selected.join('-') : '全部'}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const currentMarketLabel =
    markets.length && selected.length === markets.length
      ? '全部应用市场'
      : selected.length === 0
      ? '全部应用市场'
      : selected.join(' / ');

  return (
    <div className={styles.page}>
      <FadeInSection delay={0} duration={0.8}>
        <FilterBar showPlatform={false} showAgency={false} onSearch={() => load()} />
      </FadeInSection>

      <FadeInSection delay={0.1} duration={0.8}>
        <Card className={styles.filterCard} size="small">
          <Space size="middle" wrap>
            <span className={styles.filterLabel}>应用市场</span>
            <Select
              mode="multiple"
              allowClear
              placeholder="全部应用市场"
              value={selected}
              onChange={(v) => setSelected(v || [])}
              style={{ minWidth: 320 }}
              maxTagCount="responsive"
              options={markets.map((m) => ({ label: m, value: m }))}
            />
            <Button icon={<ReloadOutlined />} onClick={resetFilters}>重置(全部)</Button>
          </Space>
        </Card>
      </FadeInSection>

      <Spin spinning={loading}>
        {/* 二、开户概览 */}
        <FadeInSection delay={0.2} duration={0.8}>
          <MetricSection
            title={`${currentMarketLabel} · 开户概览`}
            description="总开户=广告开户节点(资金账号完成+互联网引流+新开户)；总消耗=所选应用市场 agg_vendor_daily.花费 合计"
          >
            <MetricCard
              title="总开户"
              value={displayedOverview.total_open || 0}
              formatter="number"
              valueColor="var(--color-brand)"
              icon={<UserAddOutlined style={{ color: 'var(--color-brand)' }} />}
              description="广告开户节点（资金账号完成·互联网引流·新开户）"
              showWowChange={false}
            />
            <MetricCard
              title="总消耗"
              value={displayedOverview.total_spend || 0}
              formatter="currency"
              valueColor="var(--color-error)"
              icon={<MoneyCollectOutlined style={{ color: 'var(--color-error)' }} />}
              description="所选应用市场 agg_vendor_daily.花费 合计（平台级）"
              showWowChange={false}
            />
            <MetricCard
              title="总开户成本"
              value={displayedOverview.total_open_cost == null ? 0 : displayedOverview.total_open_cost}
              formatter="currency"
              valueColor="var(--color-success)"
              icon={<FundOutlined style={{ color: 'var(--color-success)' }} />}
              description={displayedOverview.total_open_cost == null ? '无开户，成本不可计算' : '总消耗 ÷ 总开户'}
              showWowChange={false}
            />
          </MetricSection>
        </FadeInSection>

        {/* 三、按周开户量柱状图 */}
        <FadeInSection delay={0.3} duration={0.8}>
          <Card
            size="small"
            className={styles.tableCard}
            title={
              <Space size={8} align="center">
                <CalendarOutlined style={{ color: 'var(--color-brand)' }} />
                <span>按周开户量</span>
                <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>周度口径：上周五 ~ 本周四 · 广告开户节点</span>
              </Space>
            }
          >
            {displayedWeeklyOpen.length > 0 ? <EChartsComponent option={openChartOption} height={320} /> : <Empty description={loading ? '加载中...' : '暂无周度开户数据'} />}
          </Card>
        </FadeInSection>

        {/* 四、按周分计划分析 */}
        <FadeInSection delay={0.4} duration={0.8}>
          <Card
            size="small"
            className={styles.tableCard}
            title={
              <Space size={8} align="center">
                <BarsOutlined style={{ color: 'var(--color-brand)' }} />
                <span>按周分计划分析</span>
                <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>各计划按所选周消耗降序 · 周度口径：上周五 ~ 本周四</span>
              </Space>
            }
            extra={
              <Select
                style={{ width: 190 }}
                value={selectedWeek}
                placeholder="选择周"
                onChange={(v) => setSelectedWeek(v)}
                options={(weeks || []).map((ws) => ({ label: `${weekLabel(ws)}（周五起）`, value: ws }))}
              />
            }
          >
            <Table
              size="small"
              rowKey={(r: any) => r.plan_name}
              dataSource={selectedWeekPlans}
              pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t: number) => `共 ${t} 条` }}
              scroll={{ x: 2800 }}
              columns={weekPlanColumns}
            />
          </Card>
        </FadeInSection>

        {/* 五、广告聚类分析（周度筛选：版位 / 子版位 / 版位+子版位 / 出价） */}
        <FadeInSection delay={0.5} duration={0.8}>
          <Card
            size="small"
            className={styles.tableCard}
            title={
              <Space size={8} align="center">
                <AppstoreOutlined style={{ color: 'var(--color-brand)' }} />
                <span>广告聚类分析</span>
                <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>
                  版位 / 子版位 / 版位+子版位 / 出价 × 消耗 · 广告开户量 · 广告开户成本
                </span>
              </Space>
            }
            extra={
              <Select
                style={{ width: 190 }}
                value={clusterWeek}
                placeholder="选择周"
                onChange={(v) => setClusterWeek(v)}
                options={(weeks || []).map((ws) => ({ label: `${weekLabel(ws)}（周五起）`, value: ws }))}
              />
            }
          >
            <Tabs items={clusterTabItems(clusterData)} />
          </Card>
        </FadeInSection>

        {/* 六、分计划分析（每条计划一个模块） */}
        <FadeInSection delay={0.5} duration={0.8}>
          <Card
            size="small"
            className={styles.tableCard}
            title={
              <Space size={8} align="center">
                <ApartmentOutlined style={{ color: 'var(--color-brand)' }} />
                <span>分计划分析（{displayedPlanWeekDetail.length} 个计划 · 顶部为汇总，点击「+」按周展开）</span>
              </Space>
            }
          >
            {displayedPlanWeekDetail.length === 0 ? (
              <Empty description={loading ? '加载中...' : '所选市场暂无计划分解数据'} />
            ) : (
              displayedPlanWeekDetail.map((pl) => (
                <Card
                  key={pl.plan_id}
                  size="small"
                  style={{ marginBottom: 12, borderColor: 'var(--color-border)' }}
                  title={
                    <Space size={8} wrap>
                      <Tag color="blue">{sanitizeText(pl.market)}</Tag>
                      <strong>{sanitizeText(pl.plan_name)}</strong>
                      <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>
                        ID: {pl.plan_id} · 版位: {sanitizeText(pl.placement)} / {sanitizeText(pl.sub_placement)} · 出价: {sanitizeText(pl.bid)}
                      </span>
                    </Space>
                  }
                >
                  <div style={{ marginBottom: 6, color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
                    汇总（所选日期区间合计 · 广告开户成本 = 消耗 ÷ 广告开户量）
                  </div>
                  <Table
                    size="small"
                    rowKey="__summary__"
                    dataSource={[{ ...pl.summary } as FunnelMetrics]}
                    columns={funnelMetricColumns}
                    pagination={false}
                    scroll={{ x: 'max-content' }}
                  />
                  <Collapse
                    ghost
                    style={{ marginTop: 4 }}
                    items={[
                      {
                        key: `weeks-${pl.plan_id}`,
                        label: '按周展开（上周五 ~ 本周四）',
                        children: (
                          <Table
                            size="small"
                            rowKey="week_start"
                            dataSource={pl.weeks}
                            columns={weekRowsColumns}
                            pagination={false}
                            scroll={{ x: 'max-content' }}
                          />
                        ),
                      },
                    ]}
                  />
                </Card>
              ))
            )}
          </Card>
        </FadeInSection>

        {/* 六(a) 按计划明细 */}
        <FadeInSection delay={0.6} duration={0.8}>
          <Card
            size="small"
            className={styles.tableCard}
            title={
              <Space size={8} align="center">
                <AppstoreOutlined style={{ color: 'var(--color-brand)' }} />
                <span>按计划明细（{displayedPlanDetail.length} 个计划 · 按开户数降序）</span>
              </Space>
            }
            extra={
              <Tooltip title="导出为 CSV">
                <Button icon={<DownloadOutlined />} onClick={exportPlanCsv} disabled={!displayedPlanDetail.length}>导出 CSV</Button>
              </Tooltip>
            }
          >
            <Table<PlanDetailRow>
              size="small"
              rowKey={(r) => r.plan_id}
              dataSource={displayedPlanDetail}
              pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
              scroll={{ x: 1100 }}
              columns={[
                { title: '应用市场', dataIndex: 'market', width: 100, fixed: 'left', render: (v: string) => <strong>{sanitizeText(v)}</strong> },
                { title: '广告分组ID', dataIndex: 'plan_id', width: 140, render: (v: string) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{sanitizeText(v)}</span> },
                { title: '广告分组名称', dataIndex: 'plan_name', width: 180, ellipsis: true, render: (v: string) => sanitizeText(v) },
                { title: '版位', dataIndex: 'placement', width: 120, render: (v: string) => sanitizeText(v) },
                { title: '子版位', dataIndex: 'sub_placement', width: 120, render: (v: string) => sanitizeText(v) },
                { title: '出价', dataIndex: 'bid', width: 110, ellipsis: true, render: (v: string) => sanitizeText(v) },
                {
                  title: '开户数', key: 'open_count', align: 'right', width: 100, defaultSortOrder: 'descend' as const,
                  sorter: (a: PlanDetailRow, b: PlanDetailRow) => a.open_count - b.open_count,
                  render: (_: any, r: PlanDetailRow) => <strong style={{ color: 'var(--color-brand)' }}>{r.open_count.toLocaleString()}</strong>,
                },
                {
                  title: '消耗', key: 'spend', align: 'right', width: 120,
                  sorter: (a: PlanDetailRow, b: PlanDetailRow) => a.spend - b.spend,
                  render: (_: any, r: PlanDetailRow) => fmtMoney(r.spend),
                },
                {
                  title: '开户成本', key: 'open_cost', align: 'right', width: 120,
                  sorter: (a: PlanDetailRow, b: PlanDetailRow) => (a.open_cost || 0) - (b.open_cost || 0),
                  render: (_: any, r: PlanDetailRow) => <span style={{ color: 'var(--color-error)' }}>{fmtMoney(r.open_cost)}</span>,
                },
              ]}
            />
          </Card>
        </FadeInSection>

        {/* 六(b)(c) 聚合表：版位/子版位 + 应用市场 */}
        <FadeInSection delay={0.7} duration={0.8}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
            <Card size="small" title={<Space size={8}><AppstoreOutlined style={{ color: 'var(--color-brand)' }} /><span>按版位 / 子版位 聚合</span></Space>}>
              <Table<AggRow>
                size="small"
                rowKey={(r) => `${r.placement}-${r.sub_placement}`}
                dataSource={displayedByPlacement}
                pagination={false}
                scroll={{ x: 'max-content' }}
                columns={[
                  { title: '版位', dataIndex: 'placement', width: 120, render: (v: string) => sanitizeText(v) },
                  { title: '子版位', dataIndex: 'sub_placement', width: 120, render: (v: string) => sanitizeText(v) },
                  { title: '开户数', key: 'oc', align: 'right', width: 90, sorter: (a: AggRow, b: AggRow) => a.open_count - b.open_count, render: (_: any, r: AggRow) => r.open_count.toLocaleString() },
                  { title: '消耗', key: 'sp', align: 'right', width: 120, sorter: (a: AggRow, b: AggRow) => a.spend - b.spend, render: (_: any, r: AggRow) => fmtMoney(r.spend) },
                  { title: '开户成本', key: 'ocst', align: 'right', width: 120, sorter: (a: AggRow, b: AggRow) => (a.open_cost || 0) - (b.open_cost || 0), render: (_: any, r: AggRow) => fmtMoney(r.open_cost) },
                ]}
              />
            </Card>
            <Card size="small" title={<Space size={8}><AppstoreOutlined style={{ color: 'var(--color-brand)' }} /><span>按应用市场 聚合</span></Space>}>
              <Table<AggRow>
                size="small"
                rowKey={(r) => r.market || 'unknown'}
                dataSource={displayedByMarket}
                pagination={false}
                scroll={{ x: 'max-content' }}
                columns={[
                  { title: '应用市场', dataIndex: 'market', width: 120, render: (v: string) => <strong>{sanitizeText(v)}</strong> },
                  { title: '开户数', key: 'oc', align: 'right', width: 90, sorter: (a: AggRow, b: AggRow) => a.open_count - b.open_count, render: (_: any, r: AggRow) => r.open_count.toLocaleString() },
                  { title: '消耗', key: 'sp', align: 'right', width: 120, sorter: (a: AggRow, b: AggRow) => a.spend - b.spend, render: (_: any, r: AggRow) => fmtMoney(r.spend) },
                  { title: '开户成本', key: 'ocst', align: 'right', width: 120, sorter: (a: AggRow, b: AggRow) => (a.open_cost || 0) - (b.open_cost || 0), render: (_: any, r: AggRow) => fmtMoney(r.open_cost) },
                ]}
              />
            </Card>
          </div>
        </FadeInSection>
      </Spin>

      <FadeInSection delay={1.0} duration={0.8}>
        <ReportFooter
          sources={[
            { label: '数据源', value: 'dim_ad_plan_class（应用市场计划分解）+ fact_conv_appmarket（应用市场下载链路）+ agg_vendor_daily（厂商广告投放分析）' },
            { label: '端点', value: 'POST /api/v1/reports/app-market/ad-plan-analysis' },
            { label: '总开户口径', value: '是否创建完资金账号=是 AND 渠道类型=互联网引流 AND 是否新开户=是（广告开户节点）' },
            { label: '总消耗口径', value: '所选应用市场 agg_vendor_daily.花费 之和（平台=应用市场）' },
            { label: '周度口径', value: '上周五 ~ 本周四（页面内所有按周统计均为此口径）' },
            { label: '漏斗量口径', value: '分计划各阶段量 = 应用市场下载链路按 计划+周 统计去重设备号；消耗/展示/点击 = agg_vendor_daily' },
            { label: '转化率口径', value: '步骤间转化：点击率=点击/展示、下载率=下载/点击、激活率=激活/下载、开户注册率=开户注册/激活、身份证上传率=身份证/开户注册、银行卡上传率=银行卡/身份证、开户提交率=开户提交/银行卡、开户成功率=开户成功/开户提交、广告开户率=广告开户/开户成功' },
            { label: '广告开户成本', value: '消耗 ÷ 广告开户量（广告开户量为 0 时不可计算，展示 -）' },
          ]}
          notes="广告计划分析将「计划分解维度」与「下载链路开户」和「投放消耗」打通：开户概览与按周开户量看整体量能与节奏；按周分计划看各计划每周消耗与全链路转化表现（默认最新一周，可切换）；广告聚类分析按所选周对版位/子版位/出价做 消耗·广告开户量·广告开户成本 的聚类对比；分计划展开可下钻每条计划的逐周明细。周度口径统一为上周五~本周四。注意：苹果/鸿蒙无计划分解，仅参与市场级统计，不进入计划级明细。"
        />
      </FadeInSection>
    </div>
  );
};

export default AppMarketAdPlanAnalysisPage;
