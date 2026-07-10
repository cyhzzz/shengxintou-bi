/**
 * 应用市场 / 创意效果 (v3.1 子报表 4/4, Bug 3 修复)
 *
 * 数据源: fact_conv_appmarket (按 广告计划ID + 投放账号 聚合)
 * 端点: POST /api/v1/reports/app-market/creative
 *
 * 修复:
 * 1. filter-options 原先 http.post 405 -> 已兼容 GET/POST
 * 2. Creative 端点之前没有，后端在 app_market.py 已新增 /creative 端点
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Card, Select, DatePicker, Space, Spin, Table, Tag, Button, Tooltip } from 'antd';
import { CheckCircleOutlined, DownloadOutlined, MobileOutlined, ReloadOutlined, RiseOutlined, TeamOutlined, ThunderboltOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { dataServiceReports } from '@/services/dataService';
import { MetricCard, MetricSection } from '@/components/MetricCard';
import styles from './index.module.scss';

const { RangePicker } = DatePicker;

const AppMarketCreativePage: React.FC = () => {
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([dayjs('2026-01-01'), dayjs('2026-06-30')]);
  const [appMarketFilter, setAppMarketFilter] = useState<string[]>([]);
  const [channelTypeFilter, setChannelTypeFilter] = useState<string[]>([]);
  const [opts, setOpts] = useState<{ app_markets: string[]; channel_types: string[] }>({ app_markets: [], channel_types: [] });
  const [data, setData] = useState<any[]>([]);
  const [totals, setTotals] = useState<any>({ total_plans: 0, top_plans: 0, total_activate: 0, total_open: 0, total_deposit: 0, total_valid: 0 });
  const [loading, setLoading] = useState(false);
  const [topN, setTopN] = useState(50);

  useEffect(() => {
    dataServiceReports.getAppMarketFilterOptions().then((res: any) => {
      if (res?.success) setOpts(res.data);
    }).catch(() => undefined);
  }, []);

  const filters = useMemo(() => ({
    start_date: dateRange?.[0]?.format('YYYY-MM-DD'),
    end_date: dateRange?.[1]?.format('YYYY-MM-DD'),
    app_markets: appMarketFilter.length ? appMarketFilter : undefined,
    channel_types: channelTypeFilter.length ? channelTypeFilter : undefined,
  }), [dateRange, appMarketFilter, channelTypeFilter]);

  const load = async () => {
    setLoading(true);
    try {
      const res: any = await dataServiceReports.getAppMarketCreative({ filters, top_n: topN });
      if (res?.success) {
        setData((res.data.items || []).map((item: any, index: number) => ({
          ...item,
          row_id: `${index}-${item.plan_id}-${item['应用市场']}-${item['投放账号']}-${item['渠道类型']}`,
        })));
        setTotals(res.data.totals || {});
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filters, topN]);

  const exportCsv = () => {
    if (!data.length) return;
    const headers = ['广告计划ID', '投放账号', '应用市场', '渠道类型', '激活APP', '开户成功', '入金', '有效户', '激活->开户%', '激活->有效%', '开户->有效%'];
    const rows = data.map((r) => [
      r.plan_id, r['投放账号'], r['应用市场'], r['渠道类型'],
      r['激活APP'], r['开户成功'], r['入金'], r['有效户'],
      r['激活_开户率'], r['激活_有效率'], r['开户_有效率'],
    ]);
    const csv = '\ufeff' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `应用市场创意效果_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.page}>
      <Card className={styles.filterCard} size='small'>
        <Space size='middle' wrap>
          <span className={styles.label}>日期区间</span>
          <RangePicker value={dateRange} onChange={(v) => v && v[0] && v[1] && setDateRange([v[0], v[1]])} allowClear={false} />
          <span className={styles.label}>应用市场</span>
          <Select mode='multiple' allowClear placeholder='全部' value={appMarketFilter}
            onChange={setAppMarketFilter} options={opts.app_markets.map((m) => ({ label: m, value: m }))}
            style={{ minWidth: 220 }} maxTagCount='responsive' />
          <span className={styles.label}>渠道类型</span>
          <Select mode='multiple' allowClear placeholder='全部渠道类型' value={channelTypeFilter}
            onChange={setChannelTypeFilter} options={opts.channel_types.map((c) => ({ label: c, value: c }))}
            style={{ minWidth: 200 }} maxTagCount='responsive' />
          <span className={styles.label}>Top</span>
          <Select value={topN} onChange={setTopN} options={[
            { value: 20, label: 'Top 20' },
            { value: 50, label: 'Top 50' },
            { value: 100, label: 'Top 100' },
            { value: 200, label: 'Top 200' },
          ]} style={{ width: 110 }} />
          <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
        </Space>
      </Card>
      <Spin spinning={loading}>
        <MetricSection title="创意效果概览" description="广告计划规模、激活、开户、有效户与整体转化率">
          <MetricCard
            title="创意计划数"
            value={totals.total_plans || 0}
            valueColor="var(--color-brand)"
            icon={<ThunderboltOutlined style={{ color: 'var(--color-brand)' }} />}
            description={`当前展示 Top ${data.length}`}
            showWowChange={false}
          />
          <MetricCard
            title="总激活APP"
            value={totals.total_activate || 0}
            valueColor="var(--color-success)"
            icon={<MobileOutlined style={{ color: 'var(--color-success)' }} />}
            showWowChange={false}
          />
          <MetricCard
            title="总开户成功"
            value={totals.total_open || 0}
            valueColor="var(--chart-color-7)"
            icon={<TeamOutlined style={{ color: 'var(--chart-color-7)' }} />}
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
            title="激活→有效"
            value={
              totals.total_activate > 0
                ? Number(((totals.total_valid / totals.total_activate) * 100).toFixed(2))
                : 0
            }
            formatter="percent"
            valueColor="var(--color-error)"
            icon={<RiseOutlined style={{ color: 'var(--color-error)' }} />}
            showWowChange={false}
          />
        </MetricSection>

        <Card title='广告创意效果（按广告计划ID + 投放账号聚合）' size='small'
          extra={<Tooltip title='导出为 CSV'><Button icon={<DownloadOutlined />} onClick={exportCsv} disabled={!data.length}>导出 CSV</Button></Tooltip>}>
          <Table size='small' rowKey={(r: any) => r.row_id}
            dataSource={data} pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
            scroll={{ x: 'max-content' }}
            columns={[
              { title: '排名', width: 60, align: 'center', render: (_: any, __: any, idx: number) => (
                <Tag color={idx < 3 ? 'gold' : idx < 10 ? 'blue' : 'default'}>{idx + 1}</Tag>
              ) },
              { title: '广告计划ID', dataIndex: 'plan_id', width: 140, render: (v: any, r: any) => v === r['投放账号'] ? <Tag>{v}</Tag> : <strong>{v}</strong> },
              { title: '投放账号', dataIndex: '投放账号', width: 160, ellipsis: true },
              { title: '应用市场', dataIndex: '应用市场', width: 100 },
              { title: '渠道类型', dataIndex: '渠道类型', width: 110 },
              { title: '激活APP', dataIndex: '激活APP', align: 'right', sorter: (a: any, b: any) => a['激活APP'] - b['激活APP'], render: (v: number) => v.toLocaleString() },
              { title: '开户成功', dataIndex: '开户成功', align: 'right', sorter: (a: any, b: any) => a['开户成功'] - b['开户成功'], defaultSortOrder: 'descend' as const, render: (v: number) => v.toLocaleString() },
              { title: '入金', dataIndex: '入金', align: 'right', render: (v: number) => v.toLocaleString() },
              { title: '有效户', dataIndex: '有效户', align: 'right', render: (v: number) => v.toLocaleString() },
              { title: '激活→开户', dataIndex: '激活_开户率', align: 'right', render: (v: number) => (
                <Tag color={v > 5 ? 'green' : v > 1 ? 'gold' : 'default'}>{v.toFixed(2)}%</Tag>
              ) },
              { title: '激活→有效', dataIndex: '激活_有效率', align: 'right', render: (v: number) => (
                <Tag color={v > 3 ? 'green' : v > 0.5 ? 'gold' : 'default'}>{v.toFixed(2)}%</Tag>
              ) },
              { title: '开户→有效', dataIndex: '开户_有效率', align: 'right', render: (v: number) => (
                <Tag color={v > 50 ? 'green' : v > 30 ? 'gold' : 'default'}>{v.toFixed(2)}%</Tag>
              ) },
            ]}
          />
        </Card>
      </Spin>
    </div>
  );
};

export default AppMarketCreativePage;
