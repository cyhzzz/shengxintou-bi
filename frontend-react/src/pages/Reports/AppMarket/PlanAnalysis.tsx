/**
 * 应用市场 · 计划分析 (v3.3.5 改造自原「创意效果」; v3.3.10 文件由 Creative.tsx 重命名为 PlanAnalysis.tsx)
 *
 * 业务定位：
 *   原 Creative 是按 plan_id+投放账号聚合 Top N 的「列表页」，看不出周度趋势。
 *   本页改为「计划分析」——按平台单选 + 周度走势，回答两个核心问题：
 *   1. 拿量能力：开户数 / APP激活数 是否衰减（周度量趋势）
 *   2. 精准性变化：各转化节点转化率是否稳定（周度率趋势）
 *
 * 数据源: fact_conv_appmarket（按 广告计划ID × 周起始日 聚合）
 * 端点:   POST /api/v1/reports/app-market/plan-analysis
 *
 * 页面结构:
 *   1. 筛选器（日期区间 / 应用市场单选 [含全部] / Top N）
 *   2. 核心指标卡（5 张：计划数 / 总激活 / 总新开户 / 总有效户 / 激活→新开户率）
 *   3. 周度拿量能力走势（双 Y 轴：左=激活数柱 + 右=开户数/新开户数线）
 *   4. 周度精准性走势（多线：激活→开户率 / 激活→新开户率 / 开户→有效率 / 激活→有效率）
 *   5. 计划详情表（计划 × 周 长表 + expandable 行展开每周明细）
 *   6. ReportFooter
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Card, Select, DatePicker, Space, Spin, Table, Tag, Button, Tooltip, Empty } from 'antd';
import {
  CheckCircleOutlined, DownloadOutlined, MobileOutlined, ReloadOutlined,
  RiseOutlined, SearchOutlined, ThunderboltOutlined, UserOutlined,
  LineChartOutlined, AimOutlined, FallOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import EChartsComponent from '@/components/Chart/ECharts';
import type { EChartsOption } from 'echarts';
import { ECHARTS_COLORS, pickEChartsColor } from '@/utils/echartsColors';
import { dataServiceReports } from '@/services/dataService';
import { MetricCard, MetricSection } from '@/components/MetricCard';
import { ReportFooter } from '@/components/ReportFooter';
import { FadeInSection } from '@/components';
import { sanitizeText } from '@/utils/sanitizeText';
import styles from './index.module.scss';

const { RangePicker } = DatePicker;

/**
 * 将「周五起始」的 week_start(YYYY-MM-DD) 格式化为 MMDD-MMDD 横轴标签。
 * 应用市场周度口径为上周五 ~ 本周四，周五为周起始日，故结束日 = 起始日 + 6 天（周四）。
 */
const fmtWeekLabel = (ws?: string): string => {
  if (!ws) return '-';
  const start = dayjs(ws);
  if (!start.isValid()) return ws;
  const end = start.add(6, 'day');
  return `${start.format('MMDD')}-${end.format('MMDD')}`;
};

interface PlanWeeklyPoint {
  week_start: string;
  '激活APP': number;
  '开户成功': number;
  '新开户': number;
  '入金': number;
  '有效户': number;
  '激活_开户率': number;
  '激活_新开户率': number;
  '激活_有效率': number;
  '开户_新开户率': number;
  '开户_有效率': number;
}

interface PlanItem {
  plan_id: string;
  '投放账号': string;
  totals: PlanWeeklyPoint & { 激活_开户率: number; 激活_新开户率: number; 激活_有效率: number; 开户_新开户率: number; 开户_有效率: number };
  weekly: PlanWeeklyPoint[];
}

const AppMarketPlanAnalysisPage: React.FC = () => {
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([dayjs('2026-01-01'), dayjs('2026-12-31')]);
  const [platform, setPlatform] = useState<string | undefined>(undefined); // undefined = 全部
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [planItems, setPlanItems] = useState<PlanItem[]>([]);
  const [weeklyTotals, setWeeklyTotals] = useState<PlanWeeklyPoint[]>([]);
  const [weeklyByMarket, setWeeklyByMarket] = useState<any[]>([]);
  const [marketOrder, setMarketOrder] = useState<string[]>([]);
  const [totals, setTotals] = useState<any>({ total_plans: 0, total_activate: 0, total_new_open: 0, total_valid: 0 });
  const [loading, setLoading] = useState(false);
  const [topN, setTopN] = useState(30);

  const filters = useMemo(() => ({
    start_date: dateRange?.[0]?.format('YYYY-MM-DD'),
    end_date: dateRange?.[1]?.format('YYYY-MM-DD'),
    app_market: platform || undefined,
  }), [dateRange, platform]);

  const resetFilters = () => {
    setDateRange([dayjs('2026-01-01'), dayjs('2026-12-31')]);
    setPlatform(undefined);
    setTopN(30);
  };

  const load = async () => {
    setLoading(true);
    try {
      const res: any = await dataServiceReports.getAppMarketPlanAnalysis({ filters, top_n: topN });
      if (res?.success) {
        const d = res.data || {};
        setPlatforms(d.platforms || []);
        setPlanItems((d.plan_items || []).map((p: PlanItem, idx: number) => ({ ...p, row_id: `${idx}-${p.plan_id}` })));
        setWeeklyTotals(d.weekly_totals || []);
        setWeeklyByMarket(d.weekly_by_market || []);
        setMarketOrder(d.market_order || []);
        setTotals(d.totals || {});
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filters, topN]);

  // 周度拿量能力走势（双 Y 轴：左=激活数柱 + 右=开户/新开户数线）
  const volumeOption: EChartsOption = useMemo(() => {
    if (!weeklyTotals.length) return {};
    const weekLabels = weeklyTotals.map((w) => fmtWeekLabel(w.week_start));
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        valueFormatter: (v: any) => Number(v || 0).toLocaleString(),
      },
      legend: { bottom: 0, type: 'scroll' },
      grid: { left: '3%', right: '6%', bottom: '12%', top: '12%', containLabel: true },
      xAxis: {
        type: 'category',
        data: weekLabels,
        axisLabel: { rotate: 30, fontSize: 11 },
      },
      yAxis: [
        {
          type: 'value',
          name: '激活APP(柱)',
          position: 'left',
          axisLine: { show: true, lineStyle: { color: pickEChartsColor(0) } },
        },
        {
          type: 'value',
          name: '开户/新开户(线)',
          position: 'right',
          axisLine: { show: true, lineStyle: { color: ECHARTS_COLORS[7] } },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: '激活APP',
          type: 'bar',
          yAxisIndex: 0,
          data: weeklyTotals.map((w) => w['激活APP']),
          itemStyle: { color: pickEChartsColor(0), opacity: 0.55 },
          barMaxWidth: 32,
        },
        {
          name: '开户成功',
          type: 'line',
          yAxisIndex: 1,
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          itemStyle: { color: ECHARTS_COLORS[5] },
          lineStyle: { width: 2 },
          data: weeklyTotals.map((w) => w['开户成功']),
        },
        {
          name: '新开户',
          type: 'line',
          yAxisIndex: 1,
          smooth: true,
          symbol: 'diamond',
          symbolSize: 8,
          itemStyle: { color: ECHARTS_COLORS[7] },
          lineStyle: { width: 3 },
          data: weeklyTotals.map((w) => w['新开户']),
          label: {
            show: true,
            position: 'top',
            formatter: (p: any) => Number(p.value).toLocaleString(),
          },
        },
      ],
    };
  }, [weeklyTotals]);

  // 周度精准性走势（多线转化率）
  const rateOption: EChartsOption = useMemo(() => {
    if (!weeklyTotals.length) return {};
    const weekLabels = weeklyTotals.map((w) => fmtWeekLabel(w.week_start));
    const series = [
      { key: '激活_开户率' as const, name: '激活→开户', color: pickEChartsColor(0) },
      { key: '激活_新开户率' as const, name: '激活→新开户', color: ECHARTS_COLORS[7] },
      { key: '开户_新开户率' as const, name: '开户→新开户', color: ECHARTS_COLORS[5] },
      { key: '激活_有效率' as const, name: '激活→有效', color: ECHARTS_COLORS[3] },
      { key: '开户_有效率' as const, name: '开户→有效', color: ECHARTS_COLORS[2] },
    ].map((s, idx) => ({
      name: s.name,
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      itemStyle: { color: s.color },
      lineStyle: { width: 2 },
      data: weeklyTotals.map((w) => Number(w[s.key] || 0)),
      _idx: idx,
    }));
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        valueFormatter: (v: any) => (v == null ? '-' : `${Number(v).toFixed(2)}%`),
      },
      legend: { bottom: 0, type: 'scroll' },
      grid: { left: '3%', right: '4%', bottom: '12%', top: '10%', containLabel: true },
      xAxis: {
        type: 'category',
        data: weekLabels,
        axisLabel: { rotate: 30, fontSize: 11 },
      },
      yAxis: [
        {
          type: 'value',
          name: '转化率(%)',
          axisLabel: { formatter: '{value}%' },
        },
      ],
      series: series as any,
    };
  }, [weeklyTotals]);

  // 各应用市场周度获客量（新开户）对比，跨平台；同口径：上周五~本周四，横轴 MMDD-MMDD
  const marketVolumeOption: EChartsOption = useMemo(() => {
    if (!weeklyByMarket.length || !marketOrder.length) return {};
    const weekLabels = weeklyByMarket.map((w) => fmtWeekLabel(w.week_start));
    const series = marketOrder.map((m, i) => ({
      name: m,
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 5,
      itemStyle: { color: pickEChartsColor(i) },
      lineStyle: { width: 2 },
      data: weeklyByMarket.map((w) => (w[m] ? (w[m]['新开户'] || 0) : 0)),
    }));
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        valueFormatter: (v: any) => Number(v || 0).toLocaleString(),
      },
      legend: { bottom: 0, type: 'scroll' },
      grid: { left: '3%', right: '4%', bottom: '16%', top: '10%', containLabel: true },
      xAxis: {
        type: 'category',
        data: weekLabels,
        axisLabel: { rotate: 30, fontSize: 11 },
      },
      yAxis: [
        { type: 'value', name: '新开户(获客量)' },
      ],
      series: series as any,
    };
  }, [weeklyByMarket, marketOrder]);

  // 是否衰减提示：首尾周对比
  const decayInfo = useMemo(() => {
    if (weeklyTotals.length < 2) return null;
    const first = weeklyTotals[0];
    const last = weeklyTotals[weeklyTotals.length - 1];
    const activateDiff = last['激活APP'] - first['激活APP'];
    const newOpenDiff = last['新开户'] - first['新开户'];
    const isDecay = activateDiff < 0 || newOpenDiff < 0;
    return {
      firstWeek: first.week_start,
      lastWeek: last.week_start,
      activateDiff,
      newOpenDiff,
      isDecay,
    };
  }, [weeklyTotals]);

  const exportCsv = () => {
    if (!planItems.length) return;
    const headers = ['广告计划ID', '投放账号', '周起始日', '激活APP', '开户成功', '新开户', '入金', '有效户',
      '激活→开户%', '激活→新开户%', '激活→有效%', '开户→新开户%', '开户→有效%'];
    const rows: string[] = [];
    planItems.forEach((p) => {
      p.weekly.forEach((w) => {
        rows.push([
          p.plan_id, p['投放账号'], w.week_start,
          w['激活APP'], w['开户成功'], w['新开户'], w['入金'], w['有效户'],
          w['激活_开户率'], w['激活_新开户率'], w['激活_有效率'],
          w['开户_新开户率'], w['开户_有效率'],
        ].join(','));
      });
    });
    const csv = '\ufeff' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `应用市场计划分析_${platform || '全部'}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const expandedRowRender = (r: PlanItem) => {
    if (!r.weekly?.length) {
      return <Empty description="该计划无周度数据" />;
    }
    return (
      <Table
        size="small"
        rowKey={(w: PlanWeeklyPoint) => w.week_start}
        dataSource={r.weekly}
        pagination={false}
        scroll={{ x: 'max-content' }}
        columns={[
          { title: '周度(周五~周四)', dataIndex: 'week_start', width: 140, render: (v: string) => <strong>{fmtWeekLabel(v)}</strong> },
          { title: '激活APP', dataIndex: '激活APP', align: 'right' as const, width: 100, render: (v: number) => v.toLocaleString() },
          { title: '开户成功', dataIndex: '开户成功', align: 'right' as const, width: 100, render: (v: number) => v.toLocaleString() },
          { title: '新开户', dataIndex: '新开户', align: 'right' as const, width: 100, render: (v: number) => <strong style={{ color: 'var(--color-brand)' }}>{v.toLocaleString()}</strong> },
          { title: '有效户', dataIndex: '有效户', align: 'right' as const, width: 100, render: (v: number) => v.toLocaleString() },
          { title: '激活→开户', dataIndex: '激活_开户率', align: 'right' as const, width: 110, render: (v: number) => <Tag color={v > 5 ? 'green' : v > 1 ? 'gold' : 'default'}>{v.toFixed(2)}%</Tag> },
          { title: '激活→新开户', dataIndex: '激活_新开户率', align: 'right' as const, width: 110, render: (v: number) => <Tag color={v > 3 ? 'green' : v > 0.5 ? 'gold' : 'default'}>{v.toFixed(2)}%</Tag> },
          { title: '开户→新开户', dataIndex: '开户_新开户率', align: 'right' as const, width: 110, render: (v: number) => <Tag color={v > 80 ? 'green' : v > 50 ? 'gold' : 'default'}>{v.toFixed(2)}%</Tag> },
          { title: '开户→有效', dataIndex: '开户_有效率', align: 'right' as const, width: 110, render: (v: number) => <Tag color={v > 50 ? 'green' : v > 30 ? 'gold' : 'default'}>{v.toFixed(2)}%</Tag> },
        ]}
      />
    );
  };

  return (
    <div className={styles.page}>
      <FadeInSection delay={0} duration={0.8}>
        <Card className={styles.filterCard} size='small'>
          <Space size='middle' wrap>
            <span className={styles.label}>日期区间</span>
            <RangePicker value={dateRange} onChange={(v) => v && v[0] && v[1] && setDateRange([v[0], v[1]])} allowClear={false} />
            <span className={styles.label}>应用市场</span>
            <Select
              allowClear
              placeholder="全部平台"
              value={platform}
              onChange={(v) => setPlatform(v || undefined)}
              options={platforms.map((m) => ({ label: m, value: m }))}
              style={{ minWidth: 180 }}
              showSearch
              optionFilterProp="label"
            />
            <span className={styles.label}>Top</span>
            <Select value={topN} onChange={setTopN} options={[
              { value: 10, label: 'Top 10' },
              { value: 30, label: 'Top 30' },
              { value: 50, label: 'Top 50' },
              { value: 100, label: 'Top 100' },
            ]} style={{ width: 110 }} />
            <Button type="primary" icon={<SearchOutlined />} onClick={load}>查询</Button>
            <Button icon={<ReloadOutlined />} onClick={resetFilters}>重置</Button>
          </Space>
        </Card>
      </FadeInSection>
      <Spin spinning={loading}>
        <FadeInSection delay={0.4} duration={0.8}>
          <MetricSection
            title={`${platform || '全部平台'} · 计划分析概览`}
            description="周度走势下的计划拿量能力与精准性概览（仅统计互联网引流）"
          >
            <MetricCard
              title="计划数"
              value={totals.total_plans || 0}
              valueColor="var(--color-brand)"
              icon={<ThunderboltOutlined style={{ color: 'var(--color-brand)' }} />}
              description={`当前展示 Top ${planItems.length} / 共 ${totals.total_plans || 0} 个`}
              showWowChange={false}
            />
            <MetricCard
              title="总激活APP"
              value={totals.total_activate || 0}
              valueColor="var(--color-success)"
              icon={<MobileOutlined style={{ color: 'var(--color-success)' }} />}
              description={`跨 ${totals.total_weeks || 0} 周`}
              showWowChange={false}
            />
            <MetricCard
              title="总新开户"
              value={totals.total_new_open || 0}
              valueColor="var(--color-brand)"
              icon={<UserOutlined style={{ color: 'var(--color-brand)' }} />}
              description={`核心业务产出（剔除存量）`}
              showWowChange={false}
            />
            <MetricCard
              title="总有效户"
              value={totals.total_valid || 0}
              valueColor="var(--chart-color-5)"
              icon={<CheckCircleOutlined style={{ color: 'var(--chart-color-5)' }} />}
              showWowChange={false}
            />
            <MetricCard
              title="激活→新开户"
              value={
                (totals.total_activate || 0) > 0
                  ? Number((((totals.total_new_open || 0) / totals.total_activate) * 100).toFixed(2))
                  : 0
              }
              formatter="percent"
              valueColor="var(--color-error)"
              icon={<RiseOutlined style={{ color: 'var(--color-error)' }} />}
              description={`整体精准性主指标`}
              showWowChange={false}
            />
          </MetricSection>
        </FadeInSection>

        <FadeInSection delay={0.8} duration={0.8}>
          <Card
            size="small"
            style={{ marginBottom: 16 }}
            title={
              <Space size={8} align="center">
                <LineChartOutlined style={{ color: 'var(--color-brand)' }} />
                <span>周度拿量能力走势</span>
                <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>
                  左轴：激活APP(柱) · 右轴：开户成功 / 新开户(线)
                </span>
                {decayInfo && (
                  <Tooltip title={`首周 ${fmtWeekLabel(decayInfo.firstWeek)} → 末周 ${fmtWeekLabel(decayInfo.lastWeek)}：激活 ${decayInfo.activateDiff >= 0 ? '+' : ''}${decayInfo.activateDiff}，新开户 ${decayInfo.newOpenDiff >= 0 ? '+' : ''}${decayInfo.newOpenDiff}`}>
                    <Tag color={decayInfo.isDecay ? 'red' : 'green'} style={{ marginLeft: 8 }}>
                      {decayInfo.isDecay ? <><FallOutlined /> 量能衰减</> : <><RiseOutlined /> 量能增长</>}
                    </Tag>
                  </Tooltip>
                )}
              </Space>
            }
          >
            {weeklyTotals.length > 0 ? (
              <EChartsComponent option={volumeOption} height={320} />
            ) : (
              <Empty description={loading ? '加载中...' : '暂无周度数据'} />
            )}
          </Card>
        </FadeInSection>

        <FadeInSection delay={0.9} duration={0.8}>
          <Card
            size="small"
            style={{ marginBottom: 16 }}
            title={
              <Space size={8} align="center">
                <LineChartOutlined style={{ color: 'var(--chart-color-5)' }} />
                <span>各应用市场周度获客量（新开户）</span>
                <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>
                  同口径：上周五~本周四 · 横轴 MMDD-MMDD · 仅互联网引流 · 跨平台对比
                </span>
              </Space>
            }
          >
            {weeklyByMarket.length > 0 ? (
              <EChartsComponent option={marketVolumeOption} height={340} />
            ) : (
              <Empty description={loading ? '加载中...' : '暂无周度数据'} />
            )}
          </Card>
        </FadeInSection>

        <FadeInSection delay={1.0} duration={0.8}>
          <Card
            size="small"
            style={{ marginBottom: 16 }}
            title={
              <Space size={8} align="center">
                <AimOutlined style={{ color: 'var(--color-error)' }} />
                <span>周度精准性走势</span>
                <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>
                  各转化节点转化率周度稳定性（波动越小说明精准性越稳）
                </span>
                <Tooltip title="若某周转化率突降，可能对应：素材质量下降 / 投放人群偏移 / 平台流量策略调整。建议结合「拿量能力走势」一起看——量增率降通常是流量泛化。">
                  <span style={{ color: 'var(--color-text-tertiary)', cursor: 'help' }}>?</span>
                </Tooltip>
              </Space>
            }
          >
            {weeklyTotals.length > 0 ? (
              <EChartsComponent option={rateOption} height={320} />
            ) : (
              <Empty description={loading ? '加载中...' : '暂无周度数据'} />
            )}
          </Card>
        </FadeInSection>

        <FadeInSection delay={1.2} duration={0.8}>
          <Card
            title={`计划详情（${planItems.length} 个计划 · 按新开户降序 · 展开查看周度明细）`}
            size="small"
            extra={
              <Tooltip title="导出为 CSV（按计划 × 周长表）">
                <Button icon={<DownloadOutlined />} onClick={exportCsv} disabled={!planItems.length}>导出 CSV</Button>
              </Tooltip>
            }
          >
            <Table
              size="small"
              rowKey={(r: any) => r.row_id}
              dataSource={planItems}
              pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
              scroll={{ x: 'max-content' }}
              expandable={{
                expandedRowRender,
                rowExpandable: (r: PlanItem) => (r.weekly?.length || 0) > 0,
              }}
              columns={[
                { title: '排名', width: 60, align: 'center', render: (_: any, __: any, idx: number) => (
                  <Tag color={idx < 3 ? 'gold' : idx < 10 ? 'blue' : 'default'}>{idx + 1}</Tag>
                ) },
                { title: '广告计划ID', dataIndex: 'plan_id', width: 160, render: (v: string) => <strong>{sanitizeText(v)}</strong> },
                { title: '投放账号', dataIndex: '投放账号', width: 160, ellipsis: true, render: (v: string) => sanitizeText(v) },
                {
                  title: '激活APP', key: 't_activate', align: 'right', width: 100,
                  sorter: (a: PlanItem, b: PlanItem) => a.totals['激活APP'] - b.totals['激活APP'],
                  render: (_: any, r: PlanItem) => r.totals['激活APP'].toLocaleString(),
                },
                {
                  title: '开户成功', key: 't_open', align: 'right', width: 100,
                  sorter: (a: PlanItem, b: PlanItem) => a.totals['开户成功'] - b.totals['开户成功'],
                  render: (_: any, r: PlanItem) => r.totals['开户成功'].toLocaleString(),
                },
                {
                  title: '新开户', key: 't_new_open', align: 'right', width: 100,
                  defaultSortOrder: 'descend' as const,
                  sorter: (a: PlanItem, b: PlanItem) => a.totals['新开户'] - b.totals['新开户'],
                  render: (_: any, r: PlanItem) => <strong style={{ color: 'var(--color-brand)' }}>{r.totals['新开户'].toLocaleString()}</strong>,
                },
                {
                  title: '有效户', key: 't_valid', align: 'right', width: 90,
                  sorter: (a: PlanItem, b: PlanItem) => a.totals['有效户'] - b.totals['有效户'],
                  render: (_: any, r: PlanItem) => r.totals['有效户'].toLocaleString(),
                },
                {
                  title: '激活→新开户', key: 't_rate', align: 'right', width: 120,
                  sorter: (a: PlanItem, b: PlanItem) => a.totals['激活_新开户率'] - b.totals['激活_新开户率'],
                  render: (_: any, r: PlanItem) => {
                    const v = r.totals['激活_新开户率'] || 0;
                    return <Tag color={v > 3 ? 'green' : v > 0.5 ? 'gold' : 'default'}>{v.toFixed(2)}%</Tag>;
                  },
                },
                {
                  title: '开户→有效', key: 't_vrate', align: 'right', width: 110,
                  sorter: (a: PlanItem, b: PlanItem) => a.totals['开户_有效率'] - b.totals['开户_有效率'],
                  render: (_: any, r: PlanItem) => {
                    const v = r.totals['开户_有效率'] || 0;
                    return <Tag color={v > 50 ? 'green' : v > 30 ? 'gold' : 'default'}>{v.toFixed(2)}%</Tag>;
                  },
                },
                { title: '覆盖周数', key: 'weeks', align: 'center', width: 90, render: (_: any, r: PlanItem) => <Tag color="cyan">{r.weekly?.length || 0}</Tag> },
              ]}
            />
          </Card>
        </FadeInSection>
      </Spin>
      <FadeInSection delay={1.4} duration={0.8}>
        <ReportFooter
          sources={[
            { label: '数据源', value: 'fact_conv_appmarket（按 广告计划ID × 周起始日 聚合）' },
            { label: '端点', value: 'POST /api/v1/reports/app-market/plan-analysis' },
            { label: '周度口径', value: '上周五 ~ 本周四（周五为周起始日，按「资金账号创建完成时间」切周：SQLite date(资金账号创建完成时间, \'weekday 4\', \'-6 days\')；横轴标注 MMDD-MMDD）' },
            { label: '存量剔除', value: '非互联网引流设备需剔除（与存量客户同理）' },
            { label: '平台筛选', value: 'app_market 单选（不选 = 全部平台汇总），选中后只看该平台内计划' },
          ]}
          notes={`计划分析按周度走势看两类指标：拿量能力（激活/开户/新开户量是否衰减）+ 精准性（各转化节点转化率是否稳定）。量增率降通常意味着流量泛化。「各应用市场周度获客量」为跨平台对比图，忽略平台单选筛选、仅受日期+互联网引流约束，按上周五~本周四统计，横轴标注 MMDD-MMDD，获客量取「新开户」。`}
        />
      </FadeInSection>
    </div>
  );
};

export default AppMarketPlanAnalysisPage;
