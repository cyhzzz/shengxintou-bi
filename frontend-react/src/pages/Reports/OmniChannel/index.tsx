/**
 * 全渠道获客 (v3.1 §二.5 重构)
 * 数据源：agg_daily_channel_open（唯一独立数据源，与 fact_conv_content / fact_conv_appmarket 独立）
 *
 * 页面结构（3 段，严格对齐 v3.1 §二.5 设计稿）:
 *  ① 顶部 4 指标卡：总开户 / 总入金 / 总有效户 / TOP 渠道类别 + 占比
 *  ② 4 类渠道 开户成功人数 日趋势折线图
 *  ③ 4 个 Tabs（合作机构 / 自然流入 / 员工开户 / 互联网引流）详情表
 *    表格列：渠道名称 / 开户人数 / 占本类比例 / 入金人数 / 有效户人数 / 入金率 / 有效户率
 *
 * 实际数据排序（按 开户成功人数 SUM 降序）:
 *   合作机构 60.3% / 自然流入 27.1% / 员工开户 10.9% / 互联网引流 1.7%
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Card,
  Row,
  Col,
  DatePicker,
  Space,
  Spin,
  Tabs,
  Table,
  Tag,
  Empty,
  Button,
  Segmented,
  Select,
  message,
} from 'antd';
import { BankOutlined, CheckCircleOutlined, ReloadOutlined, TeamOutlined, TrophyOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import type { EChartsOption } from 'echarts';
import { EChartsComponent } from '@/components/Chart';
import { ReportFooter } from '@/components/ReportFooter';
import { MetricCard, MetricSection } from '@/components/MetricCard';
import { dataServiceOmniChannel } from '@/services/dataService';
import { ECHARTS_COLORS, pickEChartsColor } from '@/utils/echartsColors';
import styles from './index.module.scss';

const { RangePicker } = DatePicker;

// 4 大类颜色（按实际 SUM 开户降序：合作 > 自然 > 员工 > 互联网）
// ⚠️ ECharts 不能解析 CSS var()，必须用真实 hex。JSX 用法仍然兼容（直接当 background）。
const CATEGORY_COLORS: Record<string, string> = {
  '合作机构': ECHARTS_COLORS[0],
  '自然流入': ECHARTS_COLORS[1],
  '员工开户': ECHARTS_COLORS[2],
  '互联网引流': ECHARTS_COLORS[3],
};
const CATEGORY_ORDER = ['合作机构', '自然流入', '员工开户', '互联网引流'];
// 二级渠道（渠道名称）调色板，按出现顺序循环取色
const SUBCHANNEL_PALETTE = ECHARTS_COLORS;

interface SubRow {
  channel_category: string;
  channel_name: string;
  opens: number;
  deposit: number;
  valid: number;
  valid_rate: number;
  deposit_rate: number;
}

interface CategoryRow {
  channel_category: string;
  opens: number;
  deposit: number;
  valid: number;
  valid_rate: number;
  deposit_rate: number;
}

// 后端日趋势返回长格式：每行 = (日期, 渠道类别, 渠道名称) 的 opens/deposit/valid
interface TrendRow {
  date: string;
  channel_category: string;
  channel_name: string;
  opens: number;
  deposit: number;
  valid: number;
}

const OmniChannelPage: React.FC = () => {
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([dayjs('2026-01-01'), dayjs('2026-12-31')]);
  const [summary, setSummary] = useState<{
    totals: { opens: number; deposit: number; valid: number };
    by_category: CategoryRow[];
    top_category?: { channel_category: string; share: number; opens: number } | null;
  } | null>(null);
  const [trend, setTrend] = useState<TrendRow[]>([]);
  const [byChannel, setByChannel] = useState<Record<string, SubRow[]>>({});
  const [loading, setLoading] = useState(false);

  // v3.1 §2.5: 页面级渠道类别 + 子渠道多选筛选
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedSubChannels, setSelectedSubChannels] = useState<string[]>([]);
  const [channelCategoryOptions, setChannelCategoryOptions] = useState<string[]>([]);
  const [subChannelOptions, setSubChannelOptions] = useState<string[]>([]);

  // 加载筛选选项
  useEffect(() => {
    dataServiceOmniChannel.getOmniChannelFilterOptions().then((res: any) => {
      if (res?.success && res.data) {
        setChannelCategoryOptions(res.data.channel_categories || []);
        setSubChannelOptions(res.data.sub_channels || []);
      }
    }).catch((err) => { message.warning('渠道类别选项加载失败，已使用兜底空列表'); console.error('[OmniChannel] filter options load failed:', err); });
  }, []);

  // 趋势图切换：一级/二级渠道 + 开户/有效户 维度
  const [trendLevel, setTrendLevel] = useState<'L1' | 'L2'>('L1');
  const [trendMetric, setTrendMetric] = useState<'opens' | 'valid'>('opens');
  const [trendCategory, setTrendCategory] = useState<string>('合作机构');

  // v3.1 §二.5：所有 3 个端点（summary / daily-trend / by-channel）都接受渠道类别 + 子渠道筛选
  const filters = useMemo(
    () => ({
      start_date: dateRange?.[0]?.format('YYYY-MM-DD'),
      end_date: dateRange?.[1]?.format('YYYY-MM-DD'),
      ...(selectedCategories.length > 0 ? { channel_categories: selectedCategories } : {}),
      ...(selectedSubChannels.length > 0 ? { sub_channels: selectedSubChannels } : {}),
    }),
    [dateRange, selectedCategories, selectedSubChannels]
  );

  const activeCategories = useMemo(
    () => (selectedCategories.length > 0 ? selectedCategories : CATEGORY_ORDER),
    [selectedCategories]
  );

  // 兼容旧 by-channel 路径：filters 里已有 sub_channels 时 by-channel 也透传
  const byChannelFilters = filters;;

  const load = async () => {
    setLoading(true);
    try {
      const [sumRes, trendRes, channelResponses] = await Promise.all([
        dataServiceOmniChannel.getOmniChannelSummary({ filters }),
        dataServiceOmniChannel.getOmniChannelDailyTrend({ filters }),
        Promise.all(
          activeCategories.map((category) =>
            dataServiceOmniChannel.getOmniChannelByChannel({
              filters: byChannelFilters,
              channel_category: category,
            })
          )
        ),
      ]);
      if (sumRes?.success) setSummary(sumRes.data);
      if (trendRes?.success) setTrend(trendRes.data.daily_trend || trendRes.data.trend || []);
      const map: Record<string, SubRow[]> = {};
      activeCategories.forEach((catName, idx) => {
        const res = channelResponses[idx];
        if (res?.success) map[catName] = res.data.items || [];
      });
      setByChannel(map);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch((err) => { message.error('全渠道数据加载失败，请重试'); console.error('[OmniChannel] load failed:', err); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, activeCategories, byChannelFilters]);

  const topCategory = summary?.top_category;
  // 前端 summary state 类型补 top_category 字段（TS 宽类型 any 等价兼容）


  // 趋势图：按 一级/二级渠道 + 开户/有效户 维度运行时聚合（长格式 -> 宽格式 + series）
  const chartData = useMemo(() => {
    const isL1 = trendLevel === 'L1';
    // 1) 确定 series 的 key 集合
    let seriesKeys: string[] = [];
    if (isL1) {
      seriesKeys = [...CATEGORY_ORDER];
    } else {
      const names = new Set<string>();
      trend.forEach((r) => {
        if (r.channel_category === trendCategory) names.add(r.channel_name);
      });
      seriesKeys = Array.from(names);
    }
    // 2) 按日期聚合每个 series 的指标值
    const byDate = new Map<string, Record<string, number>>();
    trend.forEach((r) => {
      const key = isL1 ? r.channel_category : r.channel_name;
      if (isL1 && !CATEGORY_ORDER.includes(key)) return;
      if (!isL1 && r.channel_category !== trendCategory) return;
      if (!byDate.has(r.date)) byDate.set(r.date, {});
      const rec = byDate.get(r.date)!;
      rec[key] = (rec[key] || 0) + (r[trendMetric] || 0);
    });
    const dates = Array.from(byDate.keys()).sort();
    const series = seriesKeys.map((k, idx) => ({
      name: k,
      type: 'line' as const,
      smooth: true,
      symbolSize: 6,
      itemStyle: { color: isL1 ? CATEGORY_COLORS[k] : pickEChartsColor(idx) },
      data: dates.map((d) => Number(byDate.get(d)?.[k] || 0)),
    }));
    return { dates, series };
  }, [trend, trendLevel, trendMetric, trendCategory]);

  const metricLabel = trendMetric === 'opens' ? '开户成功人数' : '有效户人数';
  const trendCardTitle =
    trendLevel === 'L1'
      ? `4 类渠道 ${metricLabel} 日趋势`
      : `${trendCategory} · 二级渠道 ${metricLabel} 日趋势`;

  const trendChartOption: EChartsOption = useMemo(() => {
    const { dates, series } = chartData;
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
      legend: { top: 0, type: 'scroll' },
      grid: { left: 60, right: 30, top: 40, bottom: 50 },
      xAxis: {
        type: 'category',
        data: dates,
        axisLabel: { rotate: dates.length > 20 ? 30 : 0 },
      },
      yAxis: {
        type: 'value',
        name: metricLabel,
        axisLabel: { formatter: (v: number) => v.toLocaleString() },
      },
      dataZoom: dates.length > 30 ? [{ type: 'inside' }, { type: 'slider', height: 18 }] : undefined,
      series,
    };
  }, [chartData, metricLabel]);

  const totals = summary?.totals || { opens: 0, deposit: 0, valid: 0 };

  const tabItems = activeCategories.map((cat) => {
    const rows = byChannel[cat] || [];
    const catSum = (summary?.by_category || []).find((c) => c.channel_category === cat);
    const catOpens = catSum?.opens || 0;
    return {
      key: cat,
      label: (
        <span>
          <span
            style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: CATEGORY_COLORS[cat],
              marginRight: 6,
            }}
          />
          {cat}
          <span style={{ marginLeft: 8, color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>
            ({catOpens.toLocaleString()})
          </span>
        </span>
      ),
      children: (
        <Table<SubRow>
          size="small"
          rowKey={(r) => `${r.channel_category}-${r.channel_name}`}
          dataSource={rows.filter((r) => r.opens > 0 || r.deposit > 0 || r.valid > 0)}
          pagination={false}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: <Empty description={`${cat} 本期无明细`} /> }}
          columns={[
            { title: '渠道名称', dataIndex: 'channel_name', width: 160, fixed: 'left' as const },
            {
              title: '开户人数',
              dataIndex: 'opens',
              align: 'right' as const,
              sorter: (a, b) => a.opens - b.opens,
              defaultSortOrder: 'descend' as const,
              render: (v: number) => v.toLocaleString(),
            },
            {
              title: '占本类比例',
              align: 'right' as const,
              render: (_: unknown, r: SubRow) => {
                const pct = catOpens > 0 ? (r.opens / catOpens) * 100 : 0;
                return `${pct.toFixed(2)}%`;
              },
            },
            {
              title: '入金人数',
              dataIndex: 'deposit',
              align: 'right' as const,
              render: (v: number) => v.toLocaleString(),
            },
            {
              title: '有效户人数',
              dataIndex: 'valid',
              align: 'right' as const,
              render: (v: number) => v.toLocaleString(),
            },
            {
              title: '入金率',
              dataIndex: 'deposit_rate',
              align: 'right' as const,
              render: (v: number) => {
                if (!v || isNaN(v)) return '-';
                const c = v > 30 ? 'green' : v > 10 ? 'gold' : 'default';
                return <Tag color={c}>{v.toFixed(2)}%</Tag>;
              },
            },
            {
              title: '有效户率',
              dataIndex: 'valid_rate',
              align: 'right' as const,
              render: (v: number) => {
                if (!v || isNaN(v)) return '-';
                const c = v > 20 ? 'green' : v > 5 ? 'gold' : 'default';
                return <Tag color={c}>{v.toFixed(2)}%</Tag>;
              },
            },
          ]}
          summary={(pageData) => {
            const sum = (pageData || []).reduce(
              (acc, r) => ({
                opens: acc.opens + r.opens,
                deposit: acc.deposit + r.deposit,
                valid: acc.valid + r.valid,
              }),
              { opens: 0, deposit: 0, valid: 0 }
            );
            const dr = sum.opens > 0 ? (sum.deposit / sum.opens) * 100 : 0;
            const vr = sum.opens > 0 ? (sum.valid / sum.opens) * 100 : 0;
            return (
              <Table.Summary.Row style={{ background: '#fafafa', fontWeight: 600 }}>
                <Table.Summary.Cell index={0}>合计 {cat}</Table.Summary.Cell>
                <Table.Summary.Cell index={1} align="right">{sum.opens.toLocaleString()}</Table.Summary.Cell>
                <Table.Summary.Cell index={2} align="right">100%</Table.Summary.Cell>
                <Table.Summary.Cell index={3} align="right">{sum.deposit.toLocaleString()}</Table.Summary.Cell>
                <Table.Summary.Cell index={4} align="right">{sum.valid.toLocaleString()}</Table.Summary.Cell>
                <Table.Summary.Cell index={5} align="right">
                  <Tag color="blue">{dr.toFixed(2)}%</Tag>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={6} align="right">
                  <Tag color="purple">{vr.toFixed(2)}%</Tag>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            );
          }}
        />
      ),
    };
  });

  return (
    <div className={styles.page}>
      {/* 筛选条：仅日期区间 + 刷新 */}
      <Card className={styles.filterCard} size="small">
        <Space size="middle" wrap>
          <span className={styles.label}>日期区间</span>
          <RangePicker
            value={dateRange}
            onChange={(v) => v && v[0] && v[1] && setDateRange([v[0], v[1]])}
            allowClear={false}
          />
          <span className={styles.label}>渠道类别</span>
          <Select
            mode="multiple"
            placeholder="全部类别"
            value={selectedCategories}
            onChange={setSelectedCategories}
            style={{ minWidth: 180 }}
            allowClear
            maxTagCount="responsive"
          >
            {channelCategoryOptions.map((c) => (
              <Select.Option key={c} value={c}>{c}</Select.Option>
            ))}
          </Select>
          <span className={styles.label}>子渠道</span>
          <Select
            mode="multiple"
            placeholder="全部子渠道"
            value={selectedSubChannels}
            onChange={setSelectedSubChannels}
            style={{ minWidth: 220 }}
            allowClear
            maxTagCount="responsive"
            showSearch
          >
            {subChannelOptions.map((s) => (
              <Select.Option key={s} value={s}>{s}</Select.Option>
            ))}
          </Select>
          <Button icon={<ReloadOutlined />} onClick={load}>
            刷新
          </Button>
        </Space>
      </Card>

      <Spin spinning={loading}>
        {/* ① 4 指标卡（v3.1 §二.5）：总开户 / 总入金 / 总有效户 / 4 类渠道开户 TOP + 占比 */}
        <MetricSection title="全渠道获客概览" description="开户、入金与有效户核心表现">
          <MetricCard
            title="总开户成功人数"
            value={totals.opens}
            suffix="人"
            valueColor="var(--color-brand)"
            icon={<TeamOutlined style={{ color: 'var(--color-brand)' }} />}
            showWowChange={false}
          />
          <MetricCard
            title="总入金户数"
            value={totals.deposit}
            suffix="人"
            valueColor="var(--chart-color-7)"
            icon={<BankOutlined style={{ color: 'var(--chart-color-7)' }} />}
            showWowChange={false}
          />
          <MetricCard
            title="总有效户数"
            value={totals.valid}
            suffix="人"
            valueColor="var(--color-success)"
            icon={<CheckCircleOutlined style={{ color: 'var(--color-success)' }} />}
            showWowChange={false}
          />
          {(() => {
            const internetRow = (summary?.by_category || []).find((c) => c.channel_category === '互联网引流');
            const openedCount = internetRow?.opens ?? 0;
            const validCnt = internetRow?.valid ?? 0;
            const depositCnt = internetRow?.deposit ?? 0;
            const now = new Date();
            const year = now.getFullYear();
            const yearStart = new Date(year, 0, 1).getTime();
            const yearEnd = new Date(year + 1, 0, 1).getTime();
            const elapsedRatio = Math.min(1, Math.max(0, (now.getTime() - yearStart) / (yearEnd - yearStart)));
            const openTarget = 20000 * elapsedRatio;
            const validTarget = 10000 * elapsedRatio;
            const openRate = openTarget > 0 ? Math.min(openedCount / openTarget, 2) : 0;
            const validRate = validTarget > 0 ? Math.min(validCnt / validTarget, 2) : 0;
            const dayOfYear = Math.ceil((now.getTime() - yearStart) / 86400000);
            return (
              <MetricCard
                title="互联网渠道开户数"
                value={openedCount}
                suffix="户"
                valueColor="var(--chart-color-2)"
                icon={<TrophyOutlined style={{ color: 'var(--chart-color-2)' }} />}
                description={`KPI 完成率 开户 ${(openRate * 100).toFixed(1)}% / 有效户 ${(validRate * 100).toFixed(1)}% · 时间进度 ${(elapsedRatio * 100).toFixed(1)}%（第 ${dayOfYear} 天） · 互联网引流入金 ${depositCnt.toLocaleString()} 户 / 有效 ${validCnt.toLocaleString()} 户`}
                showWowChange={false}
              />
            );
          })()}
        </MetricSection>

        {/* ② 趋势图：支持一级/二级渠道切换 + 开户/有效户 维度切换 */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={24}>
            <Card
              title={trendCardTitle}
              size="small"
              extra={
                <Space size="small" wrap>
                  <Segmented
                    value={trendLevel}
                    onChange={(v) => setTrendLevel(v as 'L1' | 'L2')}
                    options={[
                      { label: '一级渠道', value: 'L1' },
                      { label: '二级渠道', value: 'L2' },
                    ]}
                  />
                  <Segmented
                    value={trendMetric}
                    onChange={(v) => setTrendMetric(v as 'opens' | 'valid')}
                    options={[
                      { label: '开户人数', value: 'opens' },
                      { label: '有效户人数', value: 'valid' },
                    ]}
                  />
                  {trendLevel === 'L2' && (
                    <Select
                      value={trendCategory}
                      style={{ width: 140 }}
                      onChange={setTrendCategory}
                      options={CATEGORY_ORDER.map((c) => ({ label: c, value: c }))}
                    />
                  )}
                </Space>
              }
            >
              {chartData.series.length === 0 ? (
                <Empty description="该渠道下暂无二级渠道明细" />
              ) : (
                <EChartsComponent option={trendChartOption} height={380} />
              )}
            </Card>
          </Col>
        </Row>

        {/* ③ 4 Tabs 子渠道明细 */}
        <Card title="4 大类 · 子渠道明细" size="small">
          <Tabs items={tabItems} />
        </Card>

        <ReportFooter
          sources={[
            { label: '数据源', value: 'agg_daily_channel_open（唯一独立数据源，与 fact_conv_content / fact_conv_appmarket / agg_vendor_daily 独立）' },
            { label: '总开户/入金/有效户', value: `总 ${totals.opens.toLocaleString()} 开户 / ${totals.deposit.toLocaleString()} 入金 / ${totals.valid.toLocaleString()} 有效户` },
            { label: '主端点', value: 'POST /api/v1/reports/omni-channel/{summary, daily-trend, by-channel, filter-options}' },
          ]}
          notes={'顶部 TOP 渠道类别占比由后端按开户成功人数 SUM 降序算出（现阶段坚持严格只查 agg_daily_channel_open，不与其他表混查）。'}
        />
      </Spin>
    </div>
  );
};

export default OmniChannelPage;

