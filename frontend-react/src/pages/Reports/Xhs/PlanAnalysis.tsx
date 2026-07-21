/**
 * 小红书 · 计划分析 (v3.3.10)
 *
 * 业务定位：
 *   仿照应用市场计划分析的"周度走势 + Top N 计划"结构，但数据源换成 fact_conv_content，
 *   漏斗改成 6 阶段：企微 → 开口 → 有效线索 → 有效线索(不含存量) → 新开户 → 有效户。
 *   "有效线索(不含存量)" 和 "新开户" 都按业务不变式「内容平台非存量条件」剔除存量客户。
 *
 * 数据源: fact_conv_content（限定平台来源=小红书，按 广告ID × 周起始日 聚合）
 * 端点:   POST /api/v1/reports/xhs/plan-analysis
 * 维度:   广告代理商（直投 / 量子 / 绩牛 / 美洋）
 *
 * 页面结构:
 *   1. 筛选器（日期区间 / 代理商单选 [含全部] / Top N）
 *   2. 核心指标卡（5 张：计划数 / 企微 / 新开户 / 有效户 / 企微→新开户率）
 *   3. 周度拿量能力走势（双 Y 轴：左=企微柱 + 右=开口/新开户线）
 *   4. 周度精准性走势（多线：企微→开口率 / 企微→新开户率 / 企微→有效户率 / 不含存量→有效户率 等）
 *   5. 计划详情表（计划 × 周 长表 + expandable 行展开每周明细）
 *   6. ReportFooter
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Card, Select, DatePicker, Space, Spin, Table, Tag, Button, Tooltip, Empty } from 'antd';
import {
  CheckCircleOutlined, DownloadOutlined, ReloadOutlined,
  RiseOutlined, SearchOutlined,
  LineChartOutlined, AimOutlined, FallOutlined, BookOutlined, MessageOutlined,
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
import styles from '../AppMarket/index.module.scss';

const { RangePicker } = DatePicker;

// v3.3.10: 6 阶段漏斗
// 企微 → 开口 → 有效线索 → 有效线索(不含存量) → 新开户 → 有效户
interface PlanWeeklyPoint {
  week_start: string;
  企微: number;
  开口: number;
  有效线索: number;
  有效线索_不含存量: number;
  新开户: number;
  有效户: number;
  企微_开口率: number;
  企微_有效线索率: number;
  企微_不含存量率: number;
  企微_新开户率: number;
  企微_有效户率: number;
  开口_新开户率: number;
  不含存量_有效户率: number;
}

interface PlanItem {
  plan_id: string;
  广告账号: string;
  广告代理商: string;
  totals: PlanWeeklyPoint;
  weekly: PlanWeeklyPoint[];
}

// v3.3.10：业务期望代理商名单（投放评审业务侧固定这 4 家）
const TARGET_AGENCIES = ['直投', '量子', '绩牛', '美洋'];

const XhsPlanAnalysisPage: React.FC = () => {
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([dayjs('2026-01-01'), dayjs('2026-12-31')]);
  const [agency, setAgency] = useState<string | undefined>(undefined);
  const [agencies, setAgencies] = useState<string[]>([]);
  const [planItems, setPlanItems] = useState<PlanItem[]>([]);
  const [weeklyTotals, setWeeklyTotals] = useState<PlanWeeklyPoint[]>([]);
  const [totals, setTotals] = useState<any>({ total_plans: 0, total_qiwei: 0, total_xinkaihu: 0, total_youxiao_hu: 0 });
  const [loading, setLoading] = useState(false);
  const [topN, setTopN] = useState(30);
  // v3.3.10: 计划详情表 - 按广告账号多选筛选（仅影响详情表，不影响走势/指标卡）
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);

  const filters = useMemo(() => ({
    start_date: dateRange?.[0]?.format('YYYY-MM-DD'),
    end_date: dateRange?.[1]?.format('YYYY-MM-DD'),
    agency: agency || undefined,
  }), [dateRange, agency]);

  const resetFilters = () => {
    setDateRange([dayjs('2026-01-01'), dayjs('2026-12-31')]);
    setAgency(undefined);
    setTopN(30);
    setSelectedAccounts([]);
  };

  // v3.3.10: 计划详情表 - 按所选账号多选过滤
  //  - 未选（空数组）= 全部展示
  //  - 选中 N 个 = 只展示这些账号下的广告 ID 行
  //  - 走势图（weekly_totals / 5 张指标卡）不受账号筛选影响，保持代理商层级总览
  const filteredPlanItems = useMemo(() => {
    if (!selectedAccounts.length) return planItems;
    const set = new Set(selectedAccounts);
    return planItems.filter((p) => set.has(p['广告账号']));
  }, [planItems, selectedAccounts]);

  // 当前 plan_items 中所有出现过的广告账号（去重 + 排序，供多选下拉）
  const accountOptions = useMemo(() => {
    const set = new Set<string>();
    planItems.forEach((p) => {
      if (p['广告账号'] && p['广告账号'] !== '-') set.add(p['广告账号']);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
  }, [planItems]);

  // 切换代理商/重置时清空账号选择（账号是代理商下的子集，避免孤儿选项）
  useEffect(() => { setSelectedAccounts([]); }, [agency, planItems]);

  const load = async () => {
    setLoading(true);
    try {
      const res: any = await dataServiceReports.getXhsPlanAnalysis({ filters, top_n: topN });
      if (res?.success) {
        const d = res.data || {};
        const list = d.target_agencies && d.target_agencies.length > 0 ? d.target_agencies : TARGET_AGENCIES;
        setAgencies(list);
        setPlanItems((d.plan_items || []).map((p: PlanItem, idx: number) => ({
          ...p,
          row_id: `${idx}-${p.plan_id}`,
        })));
        setWeeklyTotals(d.weekly_totals || []);
        setTotals(d.totals || {});
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filters, topN]);

  // 周度拿量能力走势（双 Y 轴：左=企微柱 + 右=开口/新开户线）
  const volumeOption: EChartsOption = useMemo(() => {
    if (!weeklyTotals.length) return {};
    const weeks = weeklyTotals.map((w) => w.week_start);
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
        data: weeks,
        axisLabel: { rotate: 30, fontSize: 11 },
      },
      yAxis: [
        {
          type: 'value',
          name: '企微(柱)',
          position: 'left',
          axisLine: { show: true, lineStyle: { color: pickEChartsColor(0) } },
        },
        {
          type: 'value',
          name: '开口/新开户(线)',
          position: 'right',
          axisLine: { show: true, lineStyle: { color: ECHARTS_COLORS[7] } },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: '企微',
          type: 'bar',
          yAxisIndex: 0,
          data: weeklyTotals.map((w) => w['企微']),
          itemStyle: { color: pickEChartsColor(0), opacity: 0.55 },
          barMaxWidth: 32,
        },
        {
          name: '开口',
          type: 'line',
          yAxisIndex: 1,
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          itemStyle: { color: ECHARTS_COLORS[5] },
          lineStyle: { width: 2 },
          data: weeklyTotals.map((w) => w['开口']),
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
    const weeks = weeklyTotals.map((w) => w.week_start);
    const series = [
      { key: '企微_开口率' as const, name: '企微→开口', color: pickEChartsColor(0) },
      { key: '企微_有效线索率' as const, name: '企微→有效线索', color: ECHARTS_COLORS[5] },
      { key: '企微_新开户率' as const, name: '企微→新开户', color: ECHARTS_COLORS[7] },
      { key: '企微_有效户率' as const, name: '企微→有效户', color: ECHARTS_COLORS[3] },
      { key: '不含存量_有效户率' as const, name: '不含存量→有效户', color: ECHARTS_COLORS[2] },
    ].map((s) => ({
      name: s.name,
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      itemStyle: { color: s.color },
      lineStyle: { width: 2 },
      data: weeklyTotals.map((w) => Number(w[s.key] || 0)),
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
        data: weeks,
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

  // 是否衰减提示：首尾周对比
  const decayInfo = useMemo(() => {
    if (weeklyTotals.length < 2) return null;
    const first = weeklyTotals[0];
    const last = weeklyTotals[weeklyTotals.length - 1];
    const qiweiDiff = last['企微'] - first['企微'];
    const xinkaihuDiff = last['新开户'] - first['新开户'];
    const isDecay = qiweiDiff < 0 || xinkaihuDiff < 0;
    return {
      firstWeek: first.week_start,
      lastWeek: last.week_start,
      qiweiDiff,
      xinkaihuDiff,
      isDecay,
    };
  }, [weeklyTotals]);

  const exportCsv = (rowsSource: PlanItem[] = planItems) => {
    if (!rowsSource.length) return;
    const headers = ['广告ID', '广告账号', '广告代理商', '周起始日',
      '企微', '开口', '有效线索', '有效线索(不含存量)', '新开户', '有效户',
      '企微→开口%', '企微→有效线索%', '企微→不含存量%', '企微→新开户%', '企微→有效户%', '开口→新开户%', '不含存量→有效户%'];
    const rows: string[] = [];
    rowsSource.forEach((p) => {
      p.weekly.forEach((w) => {
        rows.push([
          p.plan_id, p['广告账号'], p['广告代理商'] || '', w.week_start,
          w['企微'], w['开口'], w['有效线索'], w['有效线索_不含存量'], w['新开户'], w['有效户'],
          w['企微_开口率'], w['企微_有效线索率'], w['企微_不含存量率'],
          w['企微_新开户率'], w['企微_有效户率'], w['开口_新开户率'], w['不含存量_有效户率'],
        ].join(','));
      });
    });
    const csv = '\ufeff' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const accountsTag = selectedAccounts.length > 0 ? `_账号x${selectedAccounts.length}` : '';
    link.download = `小红书计划分析_${agency || '全部'}${accountsTag}_${new Date().toISOString().slice(0, 10)}.csv`;
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
          { title: '周起始日', dataIndex: 'week_start', width: 120, render: (v: string) => <strong>{sanitizeText(v)}</strong> },
          { title: '企微', dataIndex: '企微', align: 'right' as const, width: 80, render: (v: number) => v.toLocaleString() },
          { title: '开口', dataIndex: '开口', align: 'right' as const, width: 80, render: (v: number) => v.toLocaleString() },
          { title: '有效线索', dataIndex: '有效线索', align: 'right' as const, width: 90, render: (v: number) => v.toLocaleString() },
          { title: '有效线索(不含存量)', dataIndex: '有效线索_不含存量', align: 'right' as const, width: 130, render: (v: number) => v.toLocaleString() },
          { title: '新开户', dataIndex: '新开户', align: 'right' as const, width: 90, render: (v: number) => <strong style={{ color: 'var(--color-brand)' }}>{v.toLocaleString()}</strong> },
          { title: '有效户', dataIndex: '有效户', align: 'right' as const, width: 90, render: (v: number) => v.toLocaleString() },
          { title: '企微→开口', dataIndex: '企微_开口率', align: 'right' as const, width: 110, render: (v: number) => <Tag color={v > 80 ? 'green' : v > 50 ? 'gold' : 'default'}>{v.toFixed(2)}%</Tag> },
          { title: '企微→新开户', dataIndex: '企微_新开户率', align: 'right' as const, width: 120, render: (v: number) => <Tag color={v > 5 ? 'green' : v > 1 ? 'gold' : 'default'}>{v.toFixed(2)}%</Tag> },
          { title: '不含存量→有效户', dataIndex: '不含存量_有效户率', align: 'right' as const, width: 140, render: (v: number) => <Tag color={v > 50 ? 'green' : v > 30 ? 'gold' : 'default'}>{v.toFixed(2)}%</Tag> },
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
            <span className={styles.label}>代理商</span>
            <Select
              allowClear
              placeholder="全部代理商"
              value={agency}
              onChange={(v) => setAgency(v || undefined)}
              options={agencies.map((m) => ({ label: m, value: m }))}
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
            title={`${agency || '全部代理商'} · 小红书计划分析概览`}
            description="周度走势下的计划拿量能力与精准性概览（投放评审业务口径，6 阶段漏斗：企微→开口→有效线索→不含存量→新开户→有效户）"
          >
            <MetricCard
              title="计划数"
              value={totals.total_plans || 0}
              valueColor="var(--color-brand)"
              icon={<BookOutlined style={{ color: 'var(--color-brand)' }} />}
              description={`当前展示 Top ${planItems.length} / 共 ${totals.total_plans || 0} 个`}
              showWowChange={false}
            />
            <MetricCard
              title="总企微"
              value={totals.total_qiwei || 0}
              valueColor="var(--color-success)"
              icon={<MessageOutlined style={{ color: 'var(--color-success)' }} />}
              description={`跨 ${totals.total_weeks || 0} 周`}
              showWowChange={false}
            />
            <MetricCard
              title="总新开户"
              value={totals.total_xinkaihu || 0}
              valueColor="var(--color-brand)"
              icon={<RiseOutlined style={{ color: 'var(--color-brand)' }} />}
              description={`剔除存量后核心产出`}
              showWowChange={false}
            />
            <MetricCard
              title="总有效户"
              value={totals.total_youxiao_hu || 0}
              valueColor="var(--chart-color-5)"
              icon={<CheckCircleOutlined style={{ color: 'var(--chart-color-5)' }} />}
              showWowChange={false}
            />
            <MetricCard
              title="企微→新开户"
              value={
                (totals.total_qiwei || 0) > 0
                  ? Number((((totals.total_xinkaihu || 0) / totals.total_qiwei) * 100).toFixed(2))
                  : 0
              }
              formatter="percent"
              valueColor="var(--color-error)"
              icon={<AimOutlined style={{ color: 'var(--color-error)' }} />}
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
                  左轴：企微(柱) · 右轴：开口 / 新开户(线)
                </span>
                {decayInfo && (
                  <Tooltip title={`首周 ${decayInfo.firstWeek} → 末周 ${decayInfo.lastWeek}：企微 ${decayInfo.qiweiDiff >= 0 ? '+' : ''}${decayInfo.qiweiDiff}，新开户 ${decayInfo.xinkaihuDiff >= 0 ? '+' : ''}${decayInfo.xinkaihuDiff}`}>
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
            title={
              <Space size={8} align="center" wrap>
                <span>计划详情</span>
                <Tag color="blue">
                  {selectedAccounts.length > 0
                    ? `已选 ${selectedAccounts.length} 个账号 / 显示 ${filteredPlanItems.length} 个计划`
                    : `共 ${planItems.length} 个计划`}
                </Tag>
                <span className={styles.label}>按广告账号筛选</span>
                <Select
                  mode="multiple"
                  allowClear
                  placeholder="全部账号（不选 = 全部）"
                  value={selectedAccounts}
                  onChange={(v) => setSelectedAccounts(v || [])}
                  options={accountOptions.map((a) => ({ label: a, value: a }))}
                  style={{ minWidth: 260, maxWidth: 480 }}
                  showSearch
                  optionFilterProp="label"
                  maxTagCount="responsive"
                />
                <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>
                  按新开户降序 · 展开查看周度明细
                </span>
              </Space>
            }
            size="small"
            extra={
              <Tooltip title="导出为 CSV（按当前筛选后的计划 × 周长表）">
                <Button
                  icon={<DownloadOutlined />}
                  onClick={() => exportCsv(filteredPlanItems)}
                  disabled={!filteredPlanItems.length}
                >
                  导出 CSV
                </Button>
              </Tooltip>
            }
          >
            <Table
              size="small"
              rowKey={(r: any) => r.row_id}
              dataSource={filteredPlanItems}
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
                { title: '广告ID', dataIndex: 'plan_id', width: 160, render: (v: string) => <strong>{sanitizeText(v)}</strong> },
                { title: '广告账号', dataIndex: '广告账号', width: 160, ellipsis: true, render: (v: string) => sanitizeText(v) },
                { title: '代理商', dataIndex: '广告代理商', width: 100, render: (v: string) => v ? <Tag color="cyan">{sanitizeText(v)}</Tag> : '-' },
                {
                  title: '企微', key: 't_qiwei', align: 'right', width: 80,
                  sorter: (a: PlanItem, b: PlanItem) => a.totals['企微'] - b.totals['企微'],
                  render: (_: any, r: PlanItem) => r.totals['企微'].toLocaleString(),
                },
                {
                  title: '开口', key: 't_kaihou', align: 'right', width: 80,
                  sorter: (a: PlanItem, b: PlanItem) => a.totals['开口'] - b.totals['开口'],
                  render: (_: any, r: PlanItem) => r.totals['开口'].toLocaleString(),
                },
                {
                  title: '新开户', key: 't_xinkaihu', align: 'right', width: 90,
                  defaultSortOrder: 'descend' as const,
                  sorter: (a: PlanItem, b: PlanItem) => a.totals['新开户'] - b.totals['新开户'],
                  render: (_: any, r: PlanItem) => <strong style={{ color: 'var(--color-brand)' }}>{r.totals['新开户'].toLocaleString()}</strong>,
                },
                {
                  title: '有效户', key: 't_youxiao_hu', align: 'right', width: 90,
                  sorter: (a: PlanItem, b: PlanItem) => a.totals['有效户'] - b.totals['有效户'],
                  render: (_: any, r: PlanItem) => r.totals['有效户'].toLocaleString(),
                },
                {
                  title: '企微→新开户', key: 't_rate', align: 'right', width: 130,
                  sorter: (a: PlanItem, b: PlanItem) => a.totals['企微_新开户率'] - b.totals['企微_新开户率'],
                  render: (_: any, r: PlanItem) => {
                    const v = r.totals['企微_新开户率'] || 0;
                    return <Tag color={v > 5 ? 'green' : v > 1 ? 'gold' : 'default'}>{v.toFixed(2)}%</Tag>;
                  },
                },
                {
                  title: '不含存量→有效户', key: 't_vrate', align: 'right', width: 150,
                  sorter: (a: PlanItem, b: PlanItem) => a.totals['不含存量_有效户率'] - b.totals['不含存量_有效户率'],
                  render: (_: any, r: PlanItem) => {
                    const v = r.totals['不含存量_有效户率'] || 0;
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
            { label: '数据源', value: 'fact_conv_content（平台来源=小红书，按 广告ID × 周起始日 聚合）' },
            { label: '端点', value: 'POST /api/v1/reports/xhs/plan-analysis' },
            { label: '漏斗阶段', value: '企微 → 开口 → 有效线索 → 有效线索(不含存量) → 新开户 → 有效户（6 阶段）' },
            { label: '存量剔除', value: '业务不变式「内容平台非存量条件」：是否为存量客户 = 0 OR IS NULL（用于「有效线索(不含存量)」「新开户」两阶段）' },
            { label: '周起始日', value: 'SQLite date(线索日期, \'weekday 0\', \'-6 days\') = 该日期所在周的周一' },
            { label: '代理商筛选', value: `单选 ${TARGET_AGENCIES.join(' / ')} 等（投放评审业务口径固定名单）` },
          ]}
          notes={`小红书计划分析按周度走势看两类指标：拿量能力（企微/开口/新开户量是否衰减）+ 精准性（各转化节点转化率是否稳定）。量增率降通常意味着流量泛化。`}
        />
      </FadeInSection>
    </div>
  );
};

export default XhsPlanAnalysisPage;