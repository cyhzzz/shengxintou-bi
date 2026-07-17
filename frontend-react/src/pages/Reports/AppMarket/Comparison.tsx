/**
 * 应用市场 · 市场对比（v3.1 子报表 2/4）
 * 数据源: fact_conv_appmarket
 * 维度: 应用市场 × 月份 × 渠道类型
 * 图表: 应用市场雷达对比 + 月度堆叠
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Card, Row, Col, Select, DatePicker, Space, Spin, Table, Tag, Button } from 'antd';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import EChartsComponent from '@/components/Chart/ECharts';
import { FadeInSection } from '@/components';
import type { EChartsOption } from 'echarts';
import { dataServiceReports } from '@/services/dataService';
import styles from './index.module.scss';

const { RangePicker } = DatePicker;

const AppMarketComparisonPage: React.FC = () => {
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([dayjs('2026-01-01'), dayjs('2026-12-31')]);
  const [channelType, setChannelType] = useState<string[]>([]);
  const [opts, setOpts] = useState<{ app_markets: string[]; channel_types: string[] }>({ app_markets: [], channel_types: [] });
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    dataServiceReports.getAppMarketFilterOptions().then((res: any) => {
      if (res?.success) setOpts(res.data);
    }).catch(() => undefined);
  }, []);

  const filters = useMemo(() => ({
    start_date: dateRange?.[0]?.format('YYYY-MM-DD'),
    end_date: dateRange?.[1]?.format('YYYY-MM-DD'),
    channel_types: channelType.length ? channelType : undefined,
  }), [dateRange, channelType]);

  const resetFilters = () => {
    setDateRange([dayjs('2026-01-01'), dayjs('2026-12-31')]);
    setChannelType([]);
  };

  const load = async () => {
    setLoading(true);
    try {
      const res: any = await dataServiceReports.getAppMarketSummary(filters);
      if (res?.success) setData(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filters]);

  // 雷达图：每个应用市场一个指标维度
  const radarOption: EChartsOption = useMemo(() => {
    const markets = (data?.by_market || []) as any[];
    const indicators = [
      { name: '下载数', max: 0 },
      { name: '激活APP', max: 0 },
      { name: '开户成功', max: 0 },
      { name: '新开户', max: 0 },
      { name: '入金', max: 0 },
      { name: '有效户', max: 0 },
    ];
    markets.forEach((m: any) => {
      indicators[0].max = Math.max(indicators[0].max, m.counts['激活APP'] || 0);
      indicators[1].max = Math.max(indicators[1].max, m.counts['激活APP'] || 0);
      indicators[2].max = Math.max(indicators[2].max, m.counts['开户成功'] || 0);
      indicators[3].max = Math.max(indicators[3].max, m.counts['新开户'] || 0);
      indicators[4].max = Math.max(indicators[4].max, m.counts['入金'] || 0);
      indicators[5].max = Math.max(indicators[5].max, m.counts['有效户'] || 0);
    });
    return {
      tooltip: {},
      legend: { top: 0, type: 'scroll' },
      radar: {
        indicator: indicators.map((i) => ({ ...i, max: Math.ceil(i.max * 1.1) })),
        radius: '65%',
        splitArea: { areaStyle: { color: ['rgba(24,144,255,0.04)', 'rgba(24,144,255,0.02)'] } },
      },
      series: [{
        type: 'radar',
        data: markets.slice(0, 6).map((m: any) => ({
          name: m.app_market,
          value: [
            m.counts['激活APP'] || 0,
            m.counts['激活APP'] || 0,
            m.counts['开户成功'] || 0,
            m.counts['新开户'] || 0,
            m.counts['入金'] || 0,
            m.counts['有效户'] || 0,
          ],
        })),
      }],
    };
  }, [data]);

  // 月度堆叠柱状图：横轴月份，分段应用市场
  const monthlyOption: EChartsOption = useMemo(() => {
    const months = Array.from(new Set((data?.by_month_market || []).map((r: any) => r.month))).sort();
    const markets = Array.from(new Set((data?.by_month_market || []).map((r: any) => r.app_market))).sort();
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { top: 0, type: 'scroll' },
      grid: { left: 60, right: 20, top: 30, bottom: 40 },
      xAxis: { type: 'category', data: months, axisLabel: { rotate: 30 } },
      yAxis: { type: 'value', name: '新开户' },
      series: markets.map((mk) => ({
        name: mk,
        type: 'bar',
        stack: 'total',
        data: months.map((m) => {
          const row = (data?.by_month_market || []).find((r: any) => r.month === m && r.app_market === mk);
          return row ? row.counts['新开户'] || 0 : 0;
        }),
        emphasis: { focus: 'series' },
      })),
    };
  }, [data]);

  return (
    <div className={styles.page}>
      <FadeInSection delay={0} duration={1}>
        <Card className={styles.filterCard} size='small'>
          <Space size='middle' wrap>
            <span className={styles.label}>日期区间</span>
            <RangePicker value={dateRange} onChange={(v) => v && v[0] && v[1] && setDateRange([v[0], v[1]])} allowClear={false} />
            <span className={styles.label}>渠道类型</span>
            <Select mode='multiple' allowClear placeholder='全部'
              value={channelType} onChange={setChannelType}
              options={opts.channel_types.map((t) => ({ label: t, value: t }))}
              style={{ minWidth: 180 }} maxTagCount='responsive' />
            <Button type="primary" icon={<SearchOutlined />} onClick={load}>查询</Button>
            <Button icon={<ReloadOutlined />} onClick={resetFilters}>重置</Button>
          </Space>
        </Card>
      </FadeInSection>
      <Spin spinning={loading}>
        <FadeInSection delay={0.15} duration={1}>
          <Row gutter={16} style={{ marginTop: 16 }}>
            <Col span={12}>
              <Card title='应用市场多维度雷达对比' size='small'>
                <EChartsComponent option={radarOption} height={400} />
              </Card>
            </Col>
            <Col span={12}>
              <Card title='月度堆叠柱状图（按新开户）' size='small'>
                <EChartsComponent option={monthlyOption} height={400} />
              </Card>
            </Col>
          </Row>
        </FadeInSection>

        <FadeInSection delay={0.3} duration={1}>
          <Card title='应用市场漏斗明细对比表' size='small' style={{ marginTop: 16 }}>
            <Table size='small' rowKey='app_market' dataSource={data?.by_market || []} pagination={false}
              scroll={{ x: 'max-content' }}
              columns={[
                { title: '应用市场', dataIndex: 'app_market', fixed: 'left', width: 100 },
                { title: '下载数', align: 'right', render: (_: any, r: any) => r.counts['激活APP']?.toLocaleString() || 0 },
                { title: '激活APP', align: 'right', render: (_: any, r: any) => r.counts['激活APP']?.toLocaleString() || 0 },
                { title: '开户成功', align: 'right', render: (_: any, r: any) => r.counts['开户成功']?.toLocaleString() || 0 },
                { title: '新开户', align: 'right', render: (_: any, r: any) => <strong style={{ color: 'var(--color-brand)' }}>{r.counts['新开户']?.toLocaleString() || 0}</strong> },
                { title: '入金', align: 'right', render: (_: any, r: any) => r.counts['入金']?.toLocaleString() || 0 },
                { title: '有效户', align: 'right', render: (_: any, r: any) => r.counts['有效户']?.toLocaleString() || 0 },
                {
                  title: '激活->新开户',
                  align: 'right',
                  render: (_: any, r: any) => {
                    const base = r.counts['激活APP'] || 0;
                    const v = r.counts['新开户'] || 0;
                    const p = base > 0 ? (v / base * 100).toFixed(2) : '0.00';
                    return <Tag color={Number(p) > 3 ? 'green' : Number(p) > 0.5 ? 'gold' : 'default'}>{p}%</Tag>;
                  },
                },
                {
                  title: '激活->开户',
                  align: 'right',
                  render: (_: any, r: any) => {
                    const base = r.counts['激活APP'] || 0;
                    const v = r.counts['开户成功'] || 0;
                    const p = base > 0 ? (v / base * 100).toFixed(2) : '0.00';
                    return <Tag color={Number(p) > 5 ? 'green' : 'default'}>{p}%</Tag>;
                  },
                },
                {
                  title: '激活->有效',
                  align: 'right',
                  render: (_: any, r: any) => {
                    const base = r.counts['激活APP'] || 0;
                    const v = r.counts['有效户'] || 0;
                    const p = base > 0 ? (v / base * 100).toFixed(2) : '0.00';
                    return <Tag color={Number(p) > 1 ? 'green' : 'default'}>{p}%</Tag>;
                  },
                },
              ]}
            />
          </Card>
        </FadeInSection>

        <FadeInSection delay={0.45} duration={1}>
          <Card title='渠道类型 × 应用市场分布' size='small' style={{ marginTop: 16 }}>
            <Table size='small' rowKey={(r: any) => `${r.channel_type}-${r.app_market}`}
              dataSource={data?.by_channel_type || []} pagination={false}
              scroll={{ x: 'max-content' }}
              columns={[
                { title: '渠道类型', dataIndex: 'channel_type', width: 110 },
                { title: '应用市场', dataIndex: 'app_market', width: 100 },
                { title: '下载', align: 'right', render: (_: any, r: any) => r.counts['激活APP']?.toLocaleString() || 0 },
                { title: '激活APP', align: 'right', render: (_: any, r: any) => r.counts['激活APP']?.toLocaleString() || 0 },
                { title: '开户成功', align: 'right', render: (_: any, r: any) => r.counts['开户成功']?.toLocaleString() || 0 },
                { title: '新开户', align: 'right', render: (_: any, r: any) => <strong style={{ color: 'var(--color-brand)' }}>{r.counts['新开户']?.toLocaleString() || 0}</strong> },
                { title: '有效户', align: 'right', render: (_: any, r: any) => r.counts['有效户']?.toLocaleString() || 0 },
              ]}
            />
          </Card>
        </FadeInSection>
      </Spin>
    </div>
  );
};

export default AppMarketComparisonPage;
