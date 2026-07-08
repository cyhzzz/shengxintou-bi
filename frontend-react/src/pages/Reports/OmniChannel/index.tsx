/**
 * 总览获客情况分析报表 (v2.1)
 * 数据源: agg_daily_channel_open + fact_conv_content + fact_conv_appmarket + agg_vendor_daily
 * 渠道类别 (5 大类): 互联网引流 / 合作机构 / 员工开户 / 自然流入
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  Card, Row, Col, Select, DatePicker, Table, Tag, Space, Spin, Empty,
  Statistic, Tabs, Button, Progress,
} from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { dataServiceOmniChannel } from '@/services/dataService';
import styles from './index.module.scss';

const { RangePicker } = DatePicker;

interface SummaryData {
  by_category: Array<{ channel_category: string; opens: number; valid: number; valid_rate: number }>;
  content_by_platform: Array<{ platform: string; leads: number; mouth: number; valid_lead: number; opens: number; valid: number; open_rate: number; valid_rate: number }>;
  appmarket_by_market: Array<{ app_market: string; downloads: number; activates: number; opens: number; valid: number; activate_rate: number; open_rate: number; valid_rate: number }>;
  nonad_by_channel: Array<{ channel_category: string; channel_name: string; opens: number; valid: number; valid_rate: number }>;
  total_cost: number;
  total_opens: number;
  total_valid: number;
}
interface FilterOptions {
  channel_categories: string[];
  content_platforms: string[];
  app_markets: string[];
}

const OmniChannelReport: React.FC = () => {
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([dayjs('2025-01-01'), dayjs('2026-06-30')]);
  const [opts, setOpts] = useState<FilterOptions>({ channel_categories: [], content_platforms: [], app_markets: [] });
  const [data, setData] = useState<SummaryData | null>(null);
  const [monthly, setMonthly] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    dataServiceOmniChannel.getOmniChannelFilterOptions().then((res: any) => {
      if (res?.success) setOpts(res.data);
    }).catch(() => undefined);
  }, []);
  const filters = useMemo(() => ({
    start_date: dateRange?.[0]?.format('YYYY-MM-DD'),
    end_date: dateRange?.[1]?.format('YYYY-MM-DD'),
  }), [dateRange]);
  const load = async () => {
    setLoading(true);
    try {
      const [s, m] = await Promise.all([
        dataServiceOmniChannel.getOmniChannelSummary({ filters }),
        dataServiceOmniChannel.getOmniChannelMonthlyTrend({ filters }),
      ]);
      if (s?.success) setData(s.data);
      if (m?.success) setMonthly(m.data);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [filters]);
  const byCat = data?.by_category || [];
  const totalOpens = data?.total_opens || 0;
  const totalValid = data?.total_valid || 0;
  const totalCost = data?.total_cost || 0;
  const overallValidRate = totalOpens > 0 ? (totalValid / totalOpens * 100) : 0;
  return (
    <div className={styles.page}>
      <Card className={styles.filterCard} size='small'>
        <Space size='middle' wrap>
          <span className={styles.label}>日期区间</span>
          <RangePicker value={dateRange} onChange={(v) => v && v[0] && v[1] && setDateRange([v[0], v[1]])} allowClear={false} />
          <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
        </Space>
      </Card>
      <Spin spinning={loading}>
        <Row gutter={16} className={styles.statRow}>
          <Col span={6}><Card><Statistic title='开户成功人数' value={totalOpens} /></Card></Col>
          <Col span={6}><Card><Statistic title='有效户人数' value={totalValid} styles={{ content: { color: '#52c41a' } }} /></Card></Col>
          <Col span={6}><Card><Statistic title='有效率' value={overallValidRate} precision={2} suffix='%' styles={{ content: { color: '#fa8c16' } }} /></Card></Col>
          <Col span={6}><Card><Statistic title='总花费' value={totalCost} precision={2} prefix='￥' /></Card></Col>
        </Row>
        <Card title='按渠道类别总览' size='small' style={{ marginTop: 16 }}>
          <Row gutter={16}>
            {byCat.map((c) => {
              const pct = totalOpens > 0 ? (c.opens / totalOpens * 100) : 0;
              return (
                <Col span={6} key={c.channel_category}>
                  <Card size='small' className={styles.miniCard}>
                    <div className={styles.miniTitle}>{c.channel_category}</div>
                    <div className={styles.miniMetric}>
                      <span className={styles.bigNum}>{c.opens.toLocaleString()}</span>
                      <span className={styles.smallLabel}> 开户 </span>
                    </div>
                    <div className={styles.miniSub}>
                      有效户 <b>{c.valid.toLocaleString()}</b> | 有效率 <b>{c.valid_rate.toFixed(2)}%</b>
                    </div>
                    <Progress percent={Math.round(pct)} showInfo={false} strokeColor='#1890ff' />
                    <div className={styles.pct}>{pct.toFixed(1)}% 占比</div>
                  </Card>
                </Col>
              );
            })}
          </Row>
        </Card>
        <Tabs
          style={{ marginTop: 16 }}
          items={[
            { key: 'content', label: '互联网引流.内容平台设备漏斗', children: (
                <Card size='small'>
                  <Table size='small' rowKey='platform'
                    dataSource={data?.content_by_platform || []} pagination={false}
                    columns={[
                      { title: '平台来源', dataIndex: 'platform', width: 100 },
                      { title: '线索', align: 'right', render: (_, r) => r.leads.toLocaleString() },
                      { title: '开口', align: 'right', render: (_, r) => r.mouth.toLocaleString() },
                      { title: '开户', align: 'right', render: (_, r) => r.opens.toLocaleString() },
                      { title: '有效户', align: 'right', render: (_, r) => r.valid.toLocaleString() },
                      { title: '开户转化率', align: 'right', render: (_, r) => r.open_rate.toFixed(2) + '%' },
                      { title: '有效率', align: 'right', render: (_, r) => r.valid_rate.toFixed(2) + '%' },
                    ]} />
                </Card>
              ), },
            { key: 'appmarket', label: '互联网引流.应用市场设备漏斗', children: (
                <Card size='small'>
                  <Table size='small' rowKey='app_market'
                    dataSource={data?.appmarket_by_market || []} pagination={false}
                    columns={[
                      { title: '应用市场', dataIndex: 'app_market', width: 100 },
                      { title: '下载', align: 'right', render: (_, r) => r.downloads.toLocaleString() },
                      { title: '激活APP', align: 'right', render: (_, r) => r.activates.toLocaleString() },
                      { title: '开户', align: 'right', render: (_, r) => r.opens.toLocaleString() },
                      { title: '有效户', align: 'right', render: (_, r) => r.valid.toLocaleString() },
                      { title: '激活转激', align: 'right', render: (_, r) => r.activate_rate.toFixed(2) + '%' },
                      { title: '下载转开户', align: 'right', render: (_, r) => r.open_rate.toFixed(2) + '%' },
                    ]} />
                </Card>
              ), },
            { key: 'nonad', label: '非互联网引流渠道类别 (合作机构 / 员工开户 / 自然流入)', children: (
                <Card size='small'>
                  <Table size='small'
                    rowKey={(r: any) => '-'}
                    dataSource={data?.nonad_by_channel || []} pagination={{ pageSize: 20 }}
                    columns={[
                      { title: '渠道类别', dataIndex: 'channel_category', width: 100 },
                      { title: '渠道名称', dataIndex: 'channel_name', width: 150 },
                      { title: '开户人数', align: 'right', render: (_, r) => r.opens.toLocaleString() },
                      { title: '有效户数', align: 'right', render: (_, r) => r.valid.toLocaleString() },
                      { title: '有效率', align: 'right', render: (_, r) => <Tag color={r.valid_rate > 50 ? 'green' : r.valid_rate > 10 ? 'gold' : 'default'}>{r.valid_rate.toFixed(2)}%</Tag> },
                    ]} />
                </Card>
              ), },
            { key: 'monthly', label: '月度趋势', children: (
                <>
                <Row gutter={16}>
                  <Col span={12}>
                    <Card title='内容平台' size='small'>
                      <Table size='small' rowKey='month' dataSource={monthly?.content || []} pagination={false}
                        columns={[{ title: '月份', dataIndex: 'month', width: 90 }, { title: '开户', align: 'right', render: (_, r) => r.opens.toLocaleString() }, { title: '有效户', align: 'right', render: (_, r) => r.valid.toLocaleString() }]} />
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card title='应用市场' size='small'>
                      <Table size='small' rowKey='month' dataSource={monthly?.appmarket || []} pagination={false}
                        columns={[{ title: '月份', dataIndex: 'month', width: 90 }, { title: '开户', align: 'right', render: (_, r) => r.opens.toLocaleString() }, { title: '有效户', align: 'right', render: (_, r) => r.valid.toLocaleString() }]} />
                    </Card>
                  </Col>
                </Row>
                <Card title='合作机构 / 员工开户 / 自然流入月度趋势' size='small' style={{ marginTop: 16 }}>
                  <Table size='small'
                    rowKey={(r: any) => '-'}
                    dataSource={(() => { const out: any[] = []; Object.entries(monthly?.nonad_by_category || {}).forEach(([cat, arr]: any) => (arr as any[]).forEach((r) => out.push({ ...r, channel_category: cat }))); return out; })()}
                    pagination={false}
                    columns={[
                      { title: '渠道类别', dataIndex: 'channel_category', width: 100 },
                      { title: '月份', dataIndex: 'month', width: 100 },
                      { title: '开户人数', align: 'right', render: (_, r) => r.opens.toLocaleString() },
                      { title: '有效户数', align: 'right', render: (_, r) => r.valid.toLocaleString() },
                    ]} />
                </Card>
                </>
              ), },
          ]} />
      </Spin>
    </div>
  );
};

export default OmniChannelReport;
