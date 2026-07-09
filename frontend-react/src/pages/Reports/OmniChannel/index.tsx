/**
 * 全渠道获客 (v3.1 §二.5 重构)
 * 数据源：agg_daily_channel_open（唯一独立数据源与明细独立，不与 fact_conv_content / fact_conv_appmarket 关联）
 *
 * 页面结构（五段）:
 *  1. 顶部 5 张指标卡 (总开户 / 总入金 / 总有效户 / 全金率 / 有效户率)
 *  2. 筛选条：日期区间 + 统计维度(开户/入金/有效户) + 时间维度(日/周/月) + 刷新
 *  3. 2 列图表：
 *     - 左：折线图（4 类渠道时间趋势，按当前统计维度呈现量值）
 *     - 右：占比环形图（4 类渠道在当前统计维度下的占比）
 *  4. 4 个 Tabs：合作机构 / 自然流入 / 员工开户 / 互联网引流 详情表
 *  5. 详情表列：渠道名称 / 开户数 / 占比 / 入金人数 / 入金率 / 有效户人数 / 有效户率
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
  Segmented,
  Tabs,
  Table,
  Tag,
  Empty,
  Button,
} from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import isoWeek from 'dayjs/plugin/isoWeek';
import type { EChartsOption } from 'echarts';
import { EChartsComponent } from '@/components/Chart';
import { dataServiceOmniChannel } from '@/services/dataService';
import styles from './index.module.scss';

dayjs.extend(weekOfYear);
dayjs.extend(isoWeek);

const { RangePicker } = DatePicker;

// 4 大类颜色 (按开户 SUM 降序：合作 > 自然 > 员工 > 互联网)
const CATEGORY_COLORS: Record<string, string> = {
  '合作机构': '#1677ff',
  '自然流入': '#52c41a',
  '员工开户': '#722ed1',
  '互联网引流': '#fa8c16',
};
const CATEGORY_ORDER = ['合作机构', '自然流入', '员工开户', '互联网引流'];

type MetricKey = 'opens' | 'deposit' | 'valid';
type Granularity = '日' | '周' | '月';

const METRIC_OPTIONS = [
  { label: '开户人数', value: 'opens' as MetricKey },
  { label: '入金人数', value: 'deposit' as MetricKey },
  { label: '有效户人数', value: 'valid' as MetricKey },
];
const GRAN_OPTIONS = [
  { label: '按日', value: '日' as Granularity },
  { label: '按周', value: '周' as Granularity },
  { label: '按月', value: '月' as Granularity },
];

interface TrendRow {
  date: string;
  channel_category: string;
  opens: number;
  deposit: number;
  valid: number;
}

interface CategoryRow {
  channel_category: string;
  opens: number;
  deposit: number;
  valid: number;
  valid_rate: number;
  deposit_rate: number;
}

interface SubRow extends CategoryRow {
  channel_name: string;
}

const bucketize = (row: TrendRow, granularity: Granularity): string => {
  const d = dayjs(row.date);
  if (granularity === '日') return row.date;
  if (granularity === '周') {
    const start = d.isoWeekday(1).format('YYYY-MM-DD');
    return `${start}~${d.isoWeekday(7).format('YYYY-MM-DD')}`;
  }
  return d.format('YYYY-MM');
};

const OmniChannelPage: React.FC = () => {
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([dayjs('2026-01-01'), dayjs('2026-06-30')]);
  const [metric, setMetric] = useState<MetricKey>('opens');
  const [gran, setGran] = useState<Granularity>('日');
  const [summary, setSummary] = useState<{ totals: { opens: number; deposit: number; valid: number }; by_category: CategoryRow[]; by_subchannel: SubRow[] } | null>(null);
  const [trend, setTrend] = useState<TrendRow[]>([]);
  const [byChannel, setByChannel] = useState<Record<string, SubRow[]>>({});
  const [loading, setLoading] = useState(false);

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
      const [sumRes, trendRes, merged, cat] = await Promise.all([
        dataServiceOmniChannel.getOmniChannelSummary({ filters }),
        dataServiceOmniChannel.getOmniChannelDailyTrend({ filters }),
        // 4 类别子渠道 (Promise.all + allSettled 避免单个失败塗整体)
        Promise.all(CATEGORY_ORDER.map((c) => dataServiceOmniChannel.getOmniChannelByChannel({ filters, channel_category: c }))),
        Promise.resolve(null as unknown as CategoryRow[]),
      ]);
      if (sumRes?.success) setSummary(sumRes.data);
      if (trendRes?.success) setTrend(trendRes.data.trend || []);
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

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filters]);

  // ---- 趋势图：按时间维度 + 统计维度 汇总 ----
  const aggregatedTrend = useMemo(() => {
    const map = new Map<string, Record<string, number>>();
    trend.forEach((r) => {
      if (!CATEGORY_ORDER.includes(r.channel_category)) return;
      const key = bucketize(r, gran);
      const cur = map.get(key) || { '合作机构': 0, '自然流入': 0, '员工开户': 0, '互联网引流': 0 };
      cur[r.channel_category] = (cur[r.channel_category] || 0) + (r[metric] || 0);
      map.set(key, cur);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([bucket, vals]) => ({ bucket, ...vals }));
  }, [trend, metric, gran]);

  const trendChartOption: EChartsOption = useMemo(() => {
    const xData = aggregatedTrend.map((r) => r.bucket);
    const series = CATEGORY_ORDER.map((cat) => ({
      name: cat,
      type: 'line' as const,
      smooth: true,
      symbolSize: 6,
      itemStyle: { color: CATEGORY_COLORS[cat] },
      data: aggregatedTrend.map((r) => r[cat] || 0),
    }));
    const metricLabel = METRIC_OPTIONS.find((o) => o.value === metric)?.label || '';
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
      legend: { top: 0, type: 'scroll' },
      grid: { left: 50, right: 30, top: 40, bottom: 30 },
      xAxis: { type: 'category', data: xData, axisLabel: { rotate: xData.length > 20 ? 30 : 0 } },
      yAxis: { type: 'value', name: metricLabel, axisLabel: { formatter: (v: number) => v.toLocaleString() } },
      dataZoom: xData.length > 30 ? [{ type: 'inside' }, { type: 'slider', height: 18 }] : undefined,
      series,
    };
  }, [aggregatedTrend, metric]);

  const pieChartOption: EChartsOption = useMemo(() => {
    const rows = summary?.by_category || [];
    const data = rows.map((r) => ({ name: r.channel_category, value: r[metric] || 0 }));
    return {
      tooltip: { trigger: 'item', formatter: (p: any) => `${p.name}<br/>${p.value.toLocaleString()} (占比 ${p.percent}%)` },
      legend: { orient: 'vertical', right: 10, top: 'middle', type: 'scroll' },
      series: [{
        name: METRIC_OPTIONS.find((o) => o.value === metric)?.label || '',
        type: 'pie',
        radius: ['45%', '70%'],
        center: ['38%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: '#fff', borderWidth: 2 },
        label: { show: true, formatter: `{b}\n{d}%`, fontSize: 12 },
        labelLine: { length: 8, length2: 6 },
        data,
        color: data.map((d) => CATEGORY_COLORS[d.name] || '#999'),
      }],
    };
  }, [summary, metric]);

  const totals = summary?.totals || { opens: 0, deposit: 0, valid: 0 };
  const overallDepositRate = totals.opens > 0 ? (totals.deposit / totals.opens * 100) : 0;
  const overallValidRate = totals.opens > 0 ? (totals.valid / totals.opens * 100) : 0;
  const topCategory = (summary?.by_category || []).slice().sort((a, b) => b[metric] - a[metric])[0];

  const tabItems = CATEGORY_ORDER.map((cat) => {
    const rows = byChannel[cat] || [];
    const catSum = (summary?.by_category || []).find((c) => c.channel_category === cat);
    const total = catSum?.[metric] || 0;
    return {
      key: cat,
      label: (
        <span>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: CATEGORY_COLORS[cat], marginRight: 6 }} />
          {cat}
          <span style={{ marginLeft: 8, color: '#888', fontSize: 12 }}>({total.toLocaleString()})</span>
        </span>
      ),
      children: (
        <Table<SubRow>
          size="small"
          rowKey={(r) => `${r.channel_category}-${r.channel_name}`}
          dataSource={rows.filter((r) => (r[metric] || 0) > 0 || r.opens > 0)}
          pagination={false}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: <Empty description={`${cat} 本期无明细`} /> }}
          columns={[
            { title: '渠道名称', dataIndex: 'channel_name', width: 160, fixed: 'left' as const },
            {
              title: METRIC_OPTIONS.find((o) => o.value === metric)?.label || '',
              dataIndex: metric,
              align: 'right' as const,
              sorter: (a, b) => a[metric] - b[metric],
              defaultSortOrder: 'descend' as const,
              render: (v: number) => v.toLocaleString(),
            },
            {
              title: '占本类比例',
              align: 'right' as const,
              render: (_: any, r: SubRow) => {
                const catVal = catSum?.[metric] || 0;
                const pct = catVal > 0 ? ((r[metric] || 0) / catVal * 100) : 0;
                return `${pct.toFixed(2)}%`;
              },
            },
            { title: '开户人数', dataIndex: 'opens', align: 'right' as const, render: (v: number) => v.toLocaleString(), sorter: (a, b) => a.opens - b.opens },
            { title: '入金人数', dataIndex: 'deposit', align: 'right' as const, render: (v: number) => v.toLocaleString() },
            { title: '有效户人数', dataIndex: 'valid', align: 'right' as const, render: (v: number) => v.toLocaleString() },
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
          summary={() => {
            const sum = rows.reduce(
              (acc, r) => ({ opens: acc.opens + r.opens, deposit: acc.deposit + r.deposit, valid: acc.valid + r.valid }),
              { opens: 0, deposit: 0, valid: 0 }
            );
            const dr = sum.opens > 0 ? (sum.deposit / sum.opens * 100) : 0;
            const vr = sum.opens > 0 ? (sum.valid / sum.opens * 100) : 0;
            return (
              <Table.Summary.Row style={{ background: '#fafafa', fontWeight: 600 }}>
                <Table.Summary.Cell>合计 {cat}</Table.Summary.Cell>
                <Table.Summary.Cell align="right">{(sum[metric] || 0).toLocaleString()}</Table.Summary.Cell>
                <Table.Summary.Cell align="right">100%</Table.Summary.Cell>
                <Table.Summary.Cell align="right">{sum.opens.toLocaleString()}</Table.Summary.Cell>
                <Table.Summary.Cell align="right">{sum.deposit.toLocaleString()}</Table.Summary.Cell>
                <Table.Summary.Cell align="right">{sum.valid.toLocaleString()}</Table.Summary.Cell>
                <Table.Summary.Cell align="right"><Tag color="blue">{dr.toFixed(2)}%</Tag></Table.Summary.Cell>
                <Table.Summary.Cell align="right"><Tag color="purple">{vr.toFixed(2)}%</Tag></Table.Summary.Cell>
              </Table.Summary.Row>
            );
          }}
        />
      ),
    };
  });

  return (
    <div className={styles.page}>
      {/* 筛选条 */}
      <Card className={styles.filterCard} size="small">
        <Space size="middle" wrap>
          <span className={styles.label}>日期区间</span>
          <RangePicker
            value={dateRange}
            onChange={(v) => v && v[0] && v[1] && setDateRange([v[0], v[1]])}
            allowClear={false}
          />
          <span className={styles.label}>统计维度</span>
          <Segmented<MetricKey>
            value={metric}
            onChange={(v) => setMetric(v as MetricKey)}
            options={METRIC_OPTIONS}
          />
          <span className={styles.label}>时间维度</span>
          <Segmented<Granularity>
            value={gran}
            onChange={(v) => setGran(v as Granularity)}
            options={GRAN_OPTIONS}
          />
          <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
          <span style={{ color: '#999', fontSize: 12 }}>数据源: agg_daily_channel_open · {totals.opens.toLocaleString()} 开户 / {totals.deposit.toLocaleString()} 入金 / {totals.valid.toLocaleString()} 有效户</span>
        </Space>
      </Card>

      <Spin spinning={loading}>
        {/* 5 指标卡 */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={5}>
            <Card size="small">
              <Statistic title="总开户人数" value={totals.opens} valueStyle={{ color: '#1677ff' }} suffix="人" />
            </Card>
          </Col>
          <Col span={5}>
            <Card size="small">
              <Statistic title="总入金人数" value={totals.deposit} valueStyle={{ color: '#fa8c16' }} suffix="人" />
            </Card>
          </Col>
          <Col span={5}>
            <Card size="small">
              <Statistic title="总有效户人数" value={totals.valid} valueStyle={{ color: '#52c41a' }} suffix="人" />
            </Card>
          </Col>
          <Col span={5}>
            <Card size="small">
              <Statistic
                title={"当前维度 TOP 渠道类别"}
                value={topCategory?.[metric] || 0}
                valueStyle={{ color: topCategory ? CATEGORY_COLORS[topCategory.channel_category] : '#999' }}
                suffix={`人 · ${topCategory?.channel_category || '-'}`}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small">
              <Statistic
                title="整体入金率 / 有效户率"
                value={overallDepositRate}
                precision={2}
                suffix={`% / ${overallValidRate.toFixed(2)}%`}
                valueStyle={{ color: '#722ed1' }}
              />
            </Card>
          </Col>
        </Row>

        {/* 2 列图表 */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={14}>
            <Card title={`4 类渠道 ${METRIC_OPTIONS.find((o) => o.value === metric)?.label || ''} 趋势（${gran}）`} size="small">
              <EChartsComponent option={trendChartOption} height={380} />
            </Card>
          </Col>
          <Col span={10}>
            <Card title={`4 类渠道 ${METRIC_OPTIONS.find((o) => o.value === metric)?.label || ''} 占比`} size="small">
              <EChartsComponent option={pieChartOption} height={380} />
            </Card>
          </Col>
        </Row>

        {/* 4 Tabs 子渠道明细 */}
        <Card title="4 大类 · 子渠道明细" size="small">
          <Tabs items={tabItems} />
        </Card>
      </Spin>
    </div>
  );
};

export default OmniChannelPage;
