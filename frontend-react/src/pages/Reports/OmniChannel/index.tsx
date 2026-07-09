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
  Statistic,
  Tabs,
  Table,
  Tag,
  Empty,
  Button,
  Segmented,
  Select,
} from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import type { EChartsOption } from 'echarts';
import { EChartsComponent } from '@/components/Chart';
import { dataServiceOmniChannel } from '@/services/dataService';
import styles from './index.module.scss';

const { RangePicker } = DatePicker;

// 4 大类颜色（按实际 SUM 开户降序：合作 > 自然 > 员工 > 互联网）
const CATEGORY_COLORS: Record<string, string> = {
  '合作机构': '#1677ff',
  '自然流入': '#52c41a',
  '员工开户': '#722ed1',
  '互联网引流': '#fa8c16',
};
const CATEGORY_ORDER = ['合作机构', '自然流入', '员工开户', '互联网引流'];
// 二级渠道（渠道名称）调色板，按出现顺序循环取色
const SUBCHANNEL_PALETTE = [
  '#1677ff', '#52c41a', '#722ed1', '#fa8c16', '#eb2f96', '#13c2c2',
  '#faad14', '#2f54eb', '#f5222d', '#a0d911', '#1890ff', '#531dab',
  '#08979c', '#d4380d', '#389e0d', '#c41d7f',
];

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
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([dayjs('2026-01-01'), dayjs('2026-06-30')]);
  const [summary, setSummary] = useState<{
    totals: { opens: number; deposit: number; valid: number };
    by_category: CategoryRow[];
  } | null>(null);
  const [trend, setTrend] = useState<TrendRow[]>([]);
  const [byChannel, setByChannel] = useState<Record<string, SubRow[]>>({});
  const [loading, setLoading] = useState(false);

  // 趋势图切换：一级/二级渠道 + 开户/有效户 维度
  const [trendLevel, setTrendLevel] = useState<'L1' | 'L2'>('L1');
  const [trendMetric, setTrendMetric] = useState<'opens' | 'valid'>('opens');
  const [trendCategory, setTrendCategory] = useState<string>('合作机构');

  const filters = useMemo(
    () => ({
      start_date: dateRange?.[0]?.format('YYYY-MM-DD'),
      end_date: dateRange?.[1]?.format('YYYY-MM-DD'),
    }),
    [dateRange]
  );

  const load = async () => {
    setLoading(true);
    try {
      const [sumRes, trendRes, merged] = await Promise.all([
        dataServiceOmniChannel.getOmniChannelSummary({ filters }),
        dataServiceOmniChannel.getOmniChannelDailyTrend({ filters }),
        Promise.all(
          CATEGORY_ORDER.map((c) =>
            dataServiceOmniChannel.getOmniChannelByChannel({ filters, channel_category: c })
          )
        ),
      ]);
      if (sumRes?.success) setSummary(sumRes.data);
      if (trendRes?.success) setTrend(trendRes.data.daily_trend || trendRes.data.trend || []);
      const map: Record<string, SubRow[]> = {};
      CATEGORY_ORDER.forEach((catName, idx) => {
        const res = merged[idx];
        if (res?.success) map[catName] = res.data.items || [];
      });
      setByChannel(map);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

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
      itemStyle: { color: isL1 ? CATEGORY_COLORS[k] : SUBCHANNEL_PALETTE[idx % SUBCHANNEL_PALETTE.length] },
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

  const tabItems = CATEGORY_ORDER.map((cat) => {
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
          <span style={{ marginLeft: 8, color: '#888', fontSize: 12 }}>
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
          <Button icon={<ReloadOutlined />} onClick={load}>
            刷新
          </Button>
          <span style={{ color: '#999', fontSize: 12 }}>
            数据源：agg_daily_channel_open · 总 {totals.opens.toLocaleString()} 开户 /{' '}
            {totals.deposit.toLocaleString()} 入金 / {totals.valid.toLocaleString()} 有效户
          </span>
        </Space>
      </Card>

      <Spin spinning={loading}>
        {/* ① 3 指标卡（已移除 TOP 渠道类别卡片） */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={8}>
            <Card size="small">
              <Statistic
                title="总开户成功人数"
                value={totals.opens}
                valueStyle={{ color: '#1677ff' }}
                suffix="人"
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small">
              <Statistic
                title="总入金户数"
                value={totals.deposit}
                valueStyle={{ color: '#fa8c16' }}
                suffix="人"
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small">
              <Statistic
                title="总有效户数"
                value={totals.valid}
                valueStyle={{ color: '#52c41a' }}
                suffix="人"
              />
            </Card>
          </Col>
        </Row>

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
      </Spin>
    </div>
  );
};

export default OmniChannelPage;
