/**
 * 应用市场 · 消耗和成本（v3.6.3）
 * 数据源: agg_vendor_daily
 * 4 部分: 总览指标卡 → 分市场表格 → 月度柱状图 → 周度柱状图
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Card, Spin, Table, Tag } from 'antd';
import { MoneyCollectOutlined, TeamOutlined, AimOutlined } from '@ant-design/icons';
import EChartsComponent from '@/components/Chart/ECharts';
import { FadeInSection, FilterBar } from '@/components';
import { MetricCard, MetricSection } from '@/components/MetricCard';
import { ReportFooter } from '@/components/ReportFooter';
import type { EChartsOption } from 'echarts';
import { dataServiceReports } from '@/services/dataService';
import { useFilterStore } from '@/stores';
import styles from './index.module.scss';

const PLATFORM_COLORS: Record<string, string> = {
  '华为': '#B5A084', // 莫兰迪土棕
  '小米': '#D4A373', // 莫兰迪暖杏
  '荣耀': '#8BA7C4', // 莫兰迪雾蓝
  'oppo': '#9DBE8E', // 莫兰迪鼠尾草绿
  'vivo': '#A8A8C9', // 莫兰迪薰衣草灰
  '苹果': '#C4C4C4', // 莫兰迪浅灰
  '鸿蒙': '#E0B0A0', // 莫兰迪粉杏
};

const CostAnalysisPage: React.FC = () => {
  const { dateRange } = useFilterStore();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await dataServiceReports.getAppMarketCostAnalysis({
        start_date: dateRange.startDate,
        end_date: dateRange.endDate,
      });
      if (res?.success) setData(res.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange.startDate, dateRange.endDate]);

  // ---- Part 3: 月度柱状图 ----
  const monthChartOption: EChartsOption = useMemo(() => {
    if (!data?.by_month) return {};
    const months = [...new Set(data.by_month.map((d: any) => d.month))] as string[];
    months.sort();
    const platforms: string[] = data.platforms || [];

    // 计算每月合计
    const monthTotals = months.map((m: string) => {
      let total = 0;
      platforms.forEach((p: string) => {
        const item = data.by_month.find((d: any) => d.month === m && d.platform === p);
        if (item) total += item.spend;
      });
      return { month: m, total: Math.round(total) };
    });

    const series: any[] = platforms.map((p: string) => ({
      name: p,
      type: 'bar',
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
      type: 'line',
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
    });

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
    const weeks = [...new Set(data.by_week.map((d: any) => d.week_start))] as string[];
    weeks.sort();
    const platforms: string[] = data.platforms || [];

    // 计算每周合计
    const weekTotals = weeks.map((w: string) => {
      let total = 0;
      platforms.forEach((p: string) => {
        const item = data.by_week.find((d: any) => d.week_start === w && d.platform === p);
        if (item) total += item.spend;
      });
      return { week: w, total: Math.round(total) };
    });

    const series: any[] = platforms.map((p: string) => ({
      name: p,
      type: 'bar',
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
      type: 'line',
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
    });

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

  // Part 2 表格列
  const marketColumns = [
    { title: '应用市场', dataIndex: 'platform', key: 'platform', render: (v: string) => <Tag color={PLATFORM_COLORS[v] || '#ccc'} style={{ border: 'none' }}>{v}</Tag> },
    { title: '累计消耗 (万元)', dataIndex: 'total_spend', key: 'total_spend', render: (v: number) => `¥${(v / 10000).toFixed(2)}万`, sorter: (a: any, b: any) => a.total_spend - b.total_spend },
    { title: '累计开户', dataIndex: 'total_open', key: 'total_open', sorter: (a: any, b: any) => a.total_open - b.total_open },
    { title: '开户成本 (元)', dataIndex: 'cost_per_open', key: 'cost_per_open', render: (v: number) => `¥${v.toFixed(2)}`, sorter: (a: any, b: any) => a.cost_per_open - b.cost_per_open },
  ];

  return (
    <div className={styles.page}>
      <FadeInSection>
        <FilterBar
          showPlatform={false}
          showAgency={false}
          onSearch={() => loadData()}
          onReset={() => loadData()}
        />
      </FadeInSection>

      <Spin spinning={loading}>
        {/* Part 1: 总览指标卡 */}
        <FadeInSection>
          <MetricSection title="消耗和成本概览" description="总消耗=agg_vendor_daily.花费；总开户=广告开户节点（资金账号+互联网引流+新开户，fact_conv_appmarket）">
            <MetricCard
              title="总消耗"
              value={data?.summary.total_spend}
              formatter="currency"
              prefix="¥"
              valueColor="var(--color-error)"
              icon={<MoneyCollectOutlined style={{ color: 'var(--color-error)' }} />}
              description="区间内各应用市场累计广告消耗"
              showWowChange={false}
            />
            <MetricCard
              title="总开户"
              value={data?.summary.total_open}
              valueColor="var(--color-brand)"
              icon={<TeamOutlined style={{ color: 'var(--color-brand)' }} />}
              description="区间内各应用市场累计开户人数"
              showWowChange={false}
            />
            <MetricCard
              title="平均开户成本"
              value={data?.summary.cost_per_open}
              formatter="currency"
              prefix="¥"
              suffix="/户"
              valueColor="var(--color-success)"
              icon={<AimOutlined style={{ color: 'var(--color-success)' }} />}
              description="总消耗 ÷ 总开户 · 单位转化成本"
              showWowChange={false}
            />
          </MetricSection>
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

        <FadeInSection>
          <ReportFooter
            sources={[
              { label: '数据源', value: 'agg_vendor_daily.花费（消耗）+ fact_conv_appmarket 广告开户节点（开户数）' },
              { label: '端点', value: 'POST /api/v1/reports/app-market/cost-analysis（backend/routes/reports/app_market_cost.py）' },
              { label: '口径', value: '过滤 花费 > 0 且 平台 ∈ 7 大应用市场（含鸿蒙）；开户成本 = 花费 ÷ 广告开户量（资金账号完成+互联网引流+新开户）' },
              { label: '移动端', value: 'mobileRouteHandler.ts::handleAppMarketCostAnalysis 同口径 SQL（SQLite 本地查询）' },
            ]}
          />
        </FadeInSection>
      </Spin>
    </div>
  );
};

export default CostAnalysisPage;
