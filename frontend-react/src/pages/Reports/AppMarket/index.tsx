/**
 * 应用市场专项报表页面（v2.1）
 *
 * 数据源：fact_conv_appmarket 设备级漏斗（下载 -> 激活APP -> 开户注册 -> 注册身份证 ->
 *       注册银行卡 -> 提交开户 -> 开户成功 -> 新开户 -> 入金 -> 有效户）
 * 维度：日期区间、应用市场、渠道类型
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Row,
  Col,
  Select,
  DatePicker,
  Table,
  Tag,
  Space,
  Spin,
  Empty,
  Statistic,
  Progress,
  Segmented,
  Button,
} from 'antd';
import { ReloadOutlined, AppstoreOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import {
  dataServiceReports,
  type AppMarketFunnelStep,
  type AppMarketSummary,
} from '@/services/dataService';
import styles from './index.module.scss';

const { RangePicker } = DatePicker;

const FUNNEL_STAGES = [
  '激活APP', '开户注册', '注册身份证', '注册银行卡',
  '提交开户', '开户成功', '新开户', '入金', '有效户',
];

interface FilterOptions {
  app_markets: string[];
  channel_types: string[];
}

const AppMarketReport: React.FC = () => {
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([dayjs('2026-01-01'), dayjs('2026-06-30')]);
  const [appMarketFilter, setAppMarketFilter] = useState<string[]>([]);
  const [channelTypeFilter, setChannelTypeFilter] = useState<string[]>([]);
  const [opts, setOpts] = useState<FilterOptions>({ app_markets: [], channel_types: [] });
  const [data, setData] = useState<AppMarketSummary | null>(null);
  const [detail, setDetail] = useState<{ rows: any[]; total: number; page: number; page_size: number }>({ rows: [], total: 0, page: 1, page_size: 20 });
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [view, setView] = useState<'市场对比' | '月度趋势' | '渠道分布'>('市场对比');

  useEffect(() => {
    dataServiceReports.getAppMarketFilterOptions().then((res: any) => {
      if (res?.success) setOpts(res.data);
    }).catch(() => undefined);
  }, []);

  const filters = useMemo(
    () => ({
      start_date: dateRange?.[0]?.format('YYYY-MM-DD'),
      end_date: dateRange?.[1]?.format('YYYY-MM-DD'),
      app_markets: appMarketFilter.length ? appMarketFilter : undefined,
      channel_types: channelTypeFilter.length ? channelTypeFilter : undefined,
    }),
    [dateRange, appMarketFilter, channelTypeFilter]
  );

  const load = async () => {
    setLoading(true);
    try {
      const res: any = await dataServiceReports.getAppMarketSummary(filters);
      if (res?.success) setData(res.data);
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (page = 1) => {
    setDetailLoading(true);
    try {
      const res: any = await dataServiceReports.getAppMarketDetail({ filters, page, page_size: detail.page_size });
      if (res?.success) {
        setDetail({ rows: res.data.detail, total: res.data.total, page: res.data.page, page_size: res.data.page_size });
      }
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filters]);
  useEffect(() => { loadDetail(1); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filters]);

  const total = data?.total_counts || {};
  const funnel = data?.total_funnel || [];
  const openRate = funnel.find((s) => s.step === '开户成功')?.step_rate ?? 0;
  const validRate = funnel.find((s) => s.step === '有效户')?.step_rate ?? 0;

  return (
    <div className={styles.page}>
      <Card className={styles.filterCard} size='small'>
        <Space size='middle' wrap>
          <span className={styles.label}>日期区间</span>
          <RangePicker
            value={dateRange}
            onChange={(v) => v && v[0] && v[1] && setDateRange([v[0], v[1]])}
            allowClear={false}
          />
          <span className={styles.label}>应用市场</span>
          <Select
            mode='multiple'
            allowClear
            style={{ minWidth: 220 }}
            placeholder='全部应用市场'
            value={appMarketFilter}
            onChange={setAppMarketFilter}
            options={opts.app_markets.map((m) => ({ label: m, value: m }))}
            maxTagCount='responsive'
          />
          <span className={styles.label}>渠道类型</span>
          <Select
            mode='multiple'
            allowClear
            style={{ minWidth: 180 }}
            placeholder='全部渠道类型'
            value={channelTypeFilter}
            onChange={setChannelTypeFilter}
            options={opts.channel_types.map((t) => ({ label: t, value: t }))}
            maxTagCount='responsive'
          />
          <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
        </Space>
      </Card>

      <Spin spinning={loading}>
        <Row gutter={[16, 16]} className={styles.statRow}>
          <Col xs={12} md={6} lg={6}>
            <Card size='small'><Statistic title='激活APP' value={total['激活APP'] || 0} /></Card>
          </Col>
          <Col xs={12} md={6} lg={6}>
            <Card size='small'><Statistic title='开户成功' value={total['开户成功'] || 0} styles={{ content: { color: '#1890ff' } }} /></Card>
          </Col>
          <Col xs={12} md={6} lg={6}>
            <Card size='small'>
              <Statistic title='激活 -> 开户转化' value={openRate} suffix='%' precision={2} styles={{ content: { color: '#52c41a' } }} />
            </Card>
          </Col>
          <Col xs={12} md={6} lg={6}>
            <Card size='small'>
              <Statistic title='激活 -> 有效户转化' value={validRate} suffix='%' precision={2} styles={{ content: { color: '#fa8c16' } }} />
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} lg={10}>
            <Card title='漏斗详情（激活 -> 有效户）' size='small' className={styles.funnelCard}>
              {funnel.length === 0 ? (
                <Empty />
              ) : (
                <div className={styles.funnelList}>
                  {funnel.map((s: AppMarketFunnelStep, i) => (
                    <div key={s.step} className={styles.funnelRow}>
                      <div className={styles.funnelLabel}>{s.step}</div>
                      <div className={styles.funnelBarWrap}>
                        <Progress
                          percent={i === 0 ? 100 : s.rate}
                          showInfo={false}
                          strokeColor={i === 0 ? '#722ed1' : '#1890ff'}
                          railColor='#f0f0f0'
                        />
                      </div>
                      <div className={styles.funnelCount}>{s.count.toLocaleString()}</div>
                      <div className={styles.funnelRate}>
                        {i === 0 ? '100%' : `${s.rate}%`}
                        {i > 0 && s.step_rate !== undefined && (
                          <span className={styles.funnelStepRate}>{` 步进 ${(s.step_rate * 100).toFixed(1)}%`}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </Col>

          <Col xs={24} lg={14}>
            <Card
              title='分维度透视'
              size='small'
              extra={
                <Segmented
                  value={view}
                  onChange={(v) => setView(v as any)}
                  options={['市场对比', '月度趋势', '渠道分布']}
                />
              }
            >
              {view === '市场对比' && (
                <Table
                  size='small'
                  rowKey='app_market'
                  dataSource={data?.by_market || []}
                  pagination={false}
                  columns={[
                    { title: '应用市场', dataIndex: 'app_market', fixed: 'left', width: 100 },
                    ...FUNNEL_STAGES.map((s) => ({
                      title: s,
                      key: s,
                      align: 'right' as const,
                      render: (_: any, r: any) => (r.counts[s] || 0).toLocaleString(),
                    })),
                    {
                      title: '激活 -> 开户',
                      key: 'open_rate',
                      align: 'right' as const,
                      fixed: 'right',
                      render: (_: any, r: any) => {
                        const base = r.counts['激活APP'] || 0;
                        const op = r.counts['开户成功'] || 0;
                        const p = base > 0 ? (op / base * 100).toFixed(2) : '0.00';
                        return <Tag color={Number(p) > 5 ? 'green' : 'default'}>{p}%</Tag>;
                      },
                    },
                  ]}
                  scroll={{ x: 'max-content' }}
                />
              )}

              {view === '月度趋势' && (
                <Table
                  size='small'
                  rowKey={(r: any) => `${r.month}-${r.app_market}`}
                  dataSource={data?.by_month_market || []}
                  pagination={false}
                  columns={[
                    { title: '月份', dataIndex: 'month', width: 100 },
                    { title: '应用市场', dataIndex: 'app_market', width: 100 },
                    { title: '激活APP', align: 'right', render: (_: any, r: any) => (r.counts['激活APP'] || 0).toLocaleString() },
                    { title: '开户成功', align: 'right', render: (_: any, r: any) => (r.counts['开户成功'] || 0).toLocaleString() },
                    { title: '入金', align: 'right', render: (_: any, r: any) => (r.counts['入金'] || 0).toLocaleString() },
                    { title: '有效户', align: 'right', render: (_: any, r: any) => (r.counts['有效户'] || 0).toLocaleString() },
                    {
                      title: '激活 -> 开户',
                      align: 'right',
                      render: (_: any, r: any) => `${r.final_open_rate}%`,
                    },
                  ]}
                  scroll={{ x: 'max-content' }}
                />
              )}

              {view === '渠道分布' && (
                <Table
                  size='small'
                  rowKey={(r: any) => `${r.channel_type}-${r.app_market}`}
                  dataSource={data?.by_channel_type || []}
                  pagination={false}
                  columns={[
                    { title: '渠道类型', dataIndex: 'channel_type', width: 120 },
                    { title: '应用市场', dataIndex: 'app_market', width: 100 },
                    ...FUNNEL_STAGES.map((s) => ({
                      title: s,
                      align: 'right' as const,
                      render: (_: any, r: any) => (r.counts[s] || 0).toLocaleString(),
                    })),
                  ]}
                  scroll={{ x: 'max-content' }}
                />
              )}
            </Card>
          </Col>
        </Row>

        <Card title='明细行（设备号 / 漏斗布尔）' size='small' style={{ marginTop: 16 }}>
          <Spin spinning={detailLoading}>
            <Table
              size='small'
              rowKey='id'
              dataSource={detail.rows}
              pagination={{
                current: detail.page,
                pageSize: detail.page_size,
                total: detail.total,
                showSizeChanger: true,
                onChange: (p, ps) => { setDetail({ ...detail, page: p, page_size: ps }); loadDetail(p); },
              }}
              columns={[
                { title: '下载日期', dataIndex: '下载日期', width: 110 },
                { title: '应用市场', dataIndex: '应用市场', width: 80 },
                { title: '渠道类型', dataIndex: '渠道类型', width: 110 },
                { title: '激活APP', align: 'center', render: (v: any) => v ? <Tag color='blue'>是</Tag> : <Tag>否</Tag> },
                { title: '开户成功', align: 'center', render: (v: any) => v ? <Tag color='green'>是</Tag> : <Tag>否</Tag> },
                { title: '新开户', align: 'center', render: (v: any) => v ? <Tag color='cyan'>是</Tag> : <Tag>否</Tag> },
                { title: '入金', align: 'center', render: (v: any) => v ? <Tag color='purple'>是</Tag> : <Tag>否</Tag> },
                { title: '有效户', align: 'center', render: (v: any) => v ? <Tag color='magenta'>是</Tag> : <Tag>否</Tag> },
                { title: '资金账号', dataIndex: '资金账号', width: 180, render: (v: any) => v || '-' },
              ]}
              scroll={{ x: 'max-content' }}
              locale={{ emptyText: <Empty description='无明细' /> }}
            />
          </Spin>
          <div style={{ marginTop: 8, color: '#999', fontSize: 12 }}>
            共 {detail.total.toLocaleString()} 条明细（设备级，来源 fact_conv_appmarket）
          </div>
        </Card>
      </Spin>
    </div>
  );
};

export default AppMarketReport;
