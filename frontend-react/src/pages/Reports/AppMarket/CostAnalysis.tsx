/**
 * 应用市场 · 消耗和成本（v3.6.3）
 * 数据源: agg_vendor_daily
 * 4 部分: 总览指标卡 → 分市场表格 → 月度柱状图 → 周度柱状图
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Card, Row, Col, DatePicker, Space, Spin, Table, Tag } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import EChartsComponent from '@/components/Chart/ECharts';
import { FadeInSection } from '@/components';
import type { EChartsOption } from 'echarts';
import { dataServiceReports } from '@/services/dataService';
import styles from './index.module.scss';

const { RangePicker } = DatePicker;

const PLATFORM_COLORS: Record<string, string> = {
  '华为': '#B5A084', // 莫兰迪土棕
  '小米': '#D4A373', // 莫兰迪暖杏
  '荣耀': '#8BA7C4', // 莫兰迪雾蓝
  'oppo': '#9DBE8E', // 莫兰迪鼠尾草绿
  'vivo': '#A8A8C9', // 莫兰迪薰衣草灰
  '苹果': '#C4C4C4', // 莫兰迪浅灰
};

const CostAnalysisPage: React.FC = () => {
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([dayjs('2026-01-01'), dayjs('2026-12-31')]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const loadData = async (sd: string, ed: string) => {
    setLoading(true);
    try {
      const res = await dataServiceReports.getAppMarketCostAnalysis({
        start_date: sd,
        end_date: ed,
      });
      if (res?.success) setData(res.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(dateRange[0].format('YYYY-MM-DD'), dateRange[1].format('YYYY-MM-DD'));
  }, []);

  // ---- Part 3: 月度柱状图 ----
  const monthChartOption: EChartsOption = useMemo(() => {
    if (!data?.by_month) return {};
    const months = [...new Set(data.by_month.map((d: any) => d.month))].sort();
    const platforms = data.platforms || [];

    // 计算每月合计
    const monthTotals = months.map((m: string) => {
      let total = 0;
      platforms.forEach((p: string) => {
        const item = data.by_month.find((d: any) => d.month === m && d.platform === p);
        if (item) total += item.spend;
      });
      return { month: m, total: Math.round(total) };
    });

    const series = platforms.map((p: string) => ({
      name: p,
      type: 'bar' as const,
      stack: 'total',
      barMaxWidth: 48,
      itemStyle: { color: PLATFORM_COLORS[p] || '#ccc' },
      data: months.map((m: string) => {
        const item = data.by_month.find((d: any) => d.month === m && d.platform === p);
        return item ? Math.round(item.spend) : 0;
      }),
      label: {
        show: true,
        position: 'inside',
        formatter: (params: any) => {
          const val = params.value as number;
          if (val > 0) {
            return `¥${(val / 10000).toFixed(1)}万`;
          }
          return '';
        },
        fontSize: 10,
        color: '#fff',
        fontWeight: 'bold',
      },
    }));

    // 总计折线（展示在柱状图上方）
    series.push({
      name: '合计',
      type: 'line' as const,
      stack: undefined,
      barMaxWidth: undefined,
      data: monthTotals.map((t) => t.total),
      itemStyle: { color: '#666' },
      lineStyle: { type: 'dashed', width: 1, color: '#999' },
      symbol: 'circle',
      symbolSize: 6,
      label: {
        show: true,
        position: 'top',
        formatter: (params: any) => `¥${(params.value as number / 10000).toFixed(2)}万`,
        fontSize: 11,
        color: '#333',
        fontWeight: 'bold',
      },
      // 占位用，不占堆叠
    }) as any;

    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          let total = 0;
          const lines = params
            .filter((p: any) => p.seriesName !== '合计')
            .map((p: any) => {
              total += p.value;
              return `${p.marker} ${p.seriesName}: ¥${(p.value / 10000).toFixed(2)}万`;
            });
          lines.push(`<strong>总计: ¥${(total / 10000).toFixed(2)}万</strong>`);
          return lines.join('<br/>');
        },
      },
      legend: { data: [...platforms, '合计'], bottom: 0 },
      grid: { left: 80, right: 40, top: 40, bottom: 50 },
      xAxis: { type: 'category', data: months, axisLabel: { rotate: 30, fontSize: 11 } },
      yAxis: { type: 'value', name: '消耗 (万元)', axisLabel: { formatter: (v: number) => `${(v / 10000).toFixed(0)}万` } },
      series,
    };
  }, [data]);

  // ---- Part 4: 周度柱状图 ----
  const weekChartOption: EChartsOption = useMemo(() => {
    if (!data?.by_week) return {};
    const weeks = [...new Set(data.by_week.map((d: any) => d.week_start))].sort();
    const platforms = data.platforms || [];

    // 计算每周合计
    const weekTotals = weeks.map((w: string) => {
      let total = 0;
      platforms.forEach((p: string) => {
        const item = data.by_week.find((d: any) => d.week_start === w && d.platform === p);
        if (item) total += item.spend;
      });
      return { week: w, total: Math.round(total) };
    });

    const series = platforms.map((p: string) => ({
      name: p,
      type: 'bar' as const,
      stack: 'total',
      barMaxWidth: 36,
      itemStyle: { color: PLATFORM_COLORS[p] || '#ccc' },
      data: weeks.map((w: string) => {
        const item = data.by_week.find((d: any) => d.week_start === w && d.platform === p);
        return item ? Math.round(item.spend) : 0;
      }),
      label: {
        show: true,
        position: 'inside',
        formatter: (params: any) => {
          const val = params.value as number;
          if (val > 20000) {
            return `¥${(val / 10000).toFixed(1)}万`;
          }
          return '';
        },
        fontSize: 9,
        color: '#fff',
        fontWeight: 'bold',
      },
    }));

    // 总计线
    series.push({
      name: '合计',
      type: 'line' as const,
      stack: undefined,
      barMaxWidth: undefined,
      data: weekTotals.map((t) => t.total),
      itemStyle: { color: '#666' },
      lineStyle: { type: 'dashed', width: 1, color: '#999' },
      symbol: 'circle',
      symbolSize: 5,
      label: {
        show: true,
        position: 'top',
        formatter: (params: any) => `¥${(params.value as number / 10000).toFixed(2)}万`,
        fontSize: 9,
        color: '#333',
        fontWeight: 'bold',
      },
    }) as any;

    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          let total = 0;
          const lines = params
            .filter((p: any) => p.seriesName !== '合计')
            .map((p: any) => {
              total += p.value;
              return `${p.marker} ${p.seriesName}: ¥${(p.value / 10000).toFixed(2)}万`;
            });
          lines.push(`<strong>总计: ¥${(total / 10000).toFixed(2)}万</strong>`);
          return lines.join('<br/>');
        },
      },
      legend: { data: [...platforms, '合计'], bottom: 0 },
      grid: { left: 80, right: 40, top: 35, bottom: 50 },
      xAxis: {
        type: 'category',
        data: weeks,
        axisLabel: { rotate: 60, fontSize: 9 },
      },
      yAxis: { type: 'value', name: '消耗 (万元)', axisLabel: { formatter: (v: number) => `${(v / 10000).toFixed(0)}万` } },
      series,
    };
  }, [data]);

  const handleSearch = () => {
    loadData(dateRange[0].format('YYYY-MM-DD'), dateRange[1].format('YYYY-MM-DD'));
  };

  // Part 2 表格列
  const marketColumns = [
    { title: '应用市场', dataIndex: 'platform', key: 'platform', render: (v: string) => <Tag color={PLATFORM_COLORS[v] || '#ccc'} style={{ border: 'none' }}>{v}</Tag> },
    { title: '累计消耗 (万元)', dataIndex: 'total_spend', key: 'total_spend', render: (v: number) => `¥${(v / 10000).toFixed(2)}万`, sorter: (a: any, b: any) => a.total_spend - b.total_spend },
    { title: '累计开户', dataIndex: 'total_open', key: 'total_open', sorter: (a: any, b: any) => a.total_open - b.total_open },
    { title: '开户成本 (元)', dataIndex: 'cost_per_open', key: 'cost_per_open', render: (v: number) => `¥${v.toFixed(2)}`, sorter: (a: any, b: any) => a.cost_per_open - b.cost_per_open },
  ];

  return (
    <div className={styles.page}>
      <Card className={styles.filterCard} size="small">
        <Space wrap>
          <RangePicker
            value={dateRange}
            onChange={(dates) => {
              if (dates && dates[0] && dates[1]) setDateRange([dates[0], dates[1]]);
            }}
            allowClear={false}
            format="YYYY-MM-DD"
          />
          <ReloadOutlined onClick={handleSearch} style={{ cursor: 'pointer', fontSize: 18 }} />
        </Space>
      </Card>

      <Spin spinning={loading}>
        {/* Part 1: 总览指标卡 */}
        <FadeInSection>
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={24} sm={8}>
              <Card size="small" className={styles.metricCard}>
                <div className={styles.metricLabel}>总消耗</div>
                <div className={styles.metricValue} style={{ color: '#cf1322' }}>
                  ¥{data ? (data.summary.total_spend / 10000).toFixed(2) : '--'}万
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card size="small" className={styles.metricCard}>
                <div className={styles.metricLabel}>总开户</div>
                <div className={styles.metricValue} style={{ color: '#1890ff' }}>
                  {data ? data.summary.total_open.toLocaleString() : '--'}户
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card size="small" className={styles.metricCard}>
                <div className={styles.metricLabel}>平均开户成本</div>
                <div className={styles.metricValue} style={{ color: '#52c41a' }}>
                  ¥{data ? data.summary.cost_per_open.toFixed(2) : '--'}/户
                </div>
              </Card>
            </Col>
          </Row>
        </FadeInSection>

        {/* Part 2: 分市场表格 */}
        <FadeInSection>
          <Card title="分应用市场累计数据" size="small" style={{ marginBottom: 16 }}>
            <Table
              dataSource={data?.by_market || []}
              columns={marketColumns}
              rowKey="platform"
              pagination={false}
              size="small"
            />
          </Card>
        </FadeInSection>

        {/* Part 3: 月度消耗柱状图 */}
        <FadeInSection>
          <Card title="各应用市场月度消耗" size="small" style={{ marginBottom: 16 }}>
            {data?.by_month?.length ? (
              <EChartsComponent option={monthChartOption} style={{ height: 520 }} />
            ) : (
              <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>暂无月度数据</div>
            )}
          </Card>
        </FadeInSection>

        {/* Part 4: 周度消耗柱状图 */}
        <FadeInSection>
          <Card title="各应用市场周度消耗" size="small">
            {data?.by_week?.length ? (
              <EChartsComponent option={weekChartOption} style={{ height: 560 }} />
            ) : (
              <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>暂无周度数据</div>
            )}
          </Card>
        </FadeInSection>
      </Spin>
    </div>
  );
};

export default CostAnalysisPage;
