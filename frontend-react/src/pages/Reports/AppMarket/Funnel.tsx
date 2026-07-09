/**
 * 应用市场 · 获客漏斗（v3.1 子报表 1/4）
 * 数据源: fact_conv_appmarket
 * 漏斗: 下载 → 激活APP → 开户注册 → 注册身份证 → 注册银行卡 → 提交开户 → 开户成功 → 新开户 → 入金 → 有效户
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Card, Row, Col, Select, DatePicker, Space, Spin, Statistic, Tag, Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import EChartsComponent from '@/components/Chart/ECharts';
import type { EChartsOption } from 'echarts';
import { dataServiceReports } from '@/services/dataService';
import styles from './index.module.scss';

const { RangePicker } = DatePicker;

const FUNNEL_STAGES = [
  { key: '激活APP', label: '激活APP', fromCol: 'downloads' },
  { key: '开户注册', label: '开户注册' },
  { key: '注册身份证', label: '注册身份证' },
  { key: '注册银行卡', label: '注册银行卡' },
  { key: '提交开户', label: '提交开户' },
  { key: '开户成功', label: '开户成功' },
  { key: '新开户', label: '新开户' },
  { key: '入金', label: '入金' },
  { key: '有效户', label: '有效户' },
];

const AppMarketFunnelPage: React.FC = () => {
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([dayjs('2026-01-01'), dayjs('2026-06-30')]);
  const [appMarketFilter, setAppMarketFilter] = useState<string[]>([]);
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
    app_markets: appMarketFilter.length ? appMarketFilter : undefined,
  }), [dateRange, appMarketFilter]);

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

  const total = data?.total_counts || {};
  const funnel = data?.total_funnel || [];
  const downloads = total['激活APP'] || 0; // 用激活APP 作为漏斗顶端基数
  const validCount = total['有效户'] || 0;
  const openCount = total['开户成功'] || 0;
  const depositCount = total['入金'] || 0;
  const overallRate = downloads > 0 ? (validCount / downloads * 100) : 0;

  // 漏斗图
  const funnelChartOption: EChartsOption = useMemo(() => {
    const sorted = [...funnel].sort((a, b) => (b.count || 0) - (a.count || 0));
    return {
      tooltip: {
        trigger: 'item',
        formatter: (p: any) => `${p.name}<br/>人数: ${p.value.toLocaleString()}<br/>转化率: ${p.percent}%`,
      },
      series: [{
        name: '应用市场漏斗',
        type: 'funnel',
        left: '10%',
        width: '80%',
        minSize: '0%',
        maxSize: '100%',
        sort: 'descending',
        gap: 2,
        label: { show: true, position: 'inside', formatter: (p: any) => `${p.name}\n${p.value.toLocaleString()}` },
        labelLine: { length: 10, lineStyle: { width: 1 } },
        itemStyle: { borderColor: '#fff', borderWidth: 1 },
        data: sorted,
      }],
    };
  }, [funnel]);

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
          <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
        </Space>
      </Card>
      <Spin spinning={loading}>
        {/* 5 阶段卡片 */}
        <Row gutter={16} style={{ marginTop: 16, marginBottom: 16 }}>
          <Col span={5}><Card size='small'><Statistic title='激活APP' value={downloads} valueStyle={{ color: '#1890ff' }} /></Card></Col>
          <Col span={5}><Card size='small'><Statistic title='开户成功' value={openCount} valueStyle={{ color: '#fa8c16' }} /></Card></Col>
          <Col span={5}><Card size='small'><Statistic title='入金' value={depositCount} valueStyle={{ color: '#722ed1' }} /></Card></Col>
          <Col span={5}><Card size='small'><Statistic title='有效户' value={validCount} valueStyle={{ color: '#52c41a' }} /></Card></Col>
          <Col span={4}><Card size='small'><Statistic title='激活->有效' value={overallRate} precision={2} suffix='%' valueStyle={{ color: '#f5222d' }} /></Card></Col>
        </Row>

        <Row gutter={16}>
          <Col span={14}>
            <Card title='9 阶段漏斗图' size='small'>
              <EChartsComponent option={funnelChartOption} height={460} />
            </Card>
          </Col>
          <Col span={10}>
            <Card title='各阶段转化详情' size='small'>
              <div className={styles.funnelList}>
                {funnel.map((s: any, idx: number) => (
                  <div key={s.step} className={styles.funnelItem}>
                    <div className={styles.funnelStep}>
                      <Tag color={idx === 0 ? 'blue' : 'default'}>{idx + 1}. {s.step}</Tag>
                    </div>
                    <div className={styles.funnelCount}>{s.count?.toLocaleString() || 0}</div>
                    <div className={styles.funnelRates}>
                      <Tag color={s.step_rate > 30 ? 'green' : s.step_rate > 5 ? 'gold' : 'default'}>
                        累计 {s.step_rate?.toFixed(2) || 0}%
                      </Tag>
                      {idx > 0 && (
                        <Tag color={s.rate > 50 ? 'green' : 'default'}>
                          阶段 {s.rate?.toFixed(2) || 0}%
                        </Tag>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </Col>
        </Row>
      </Spin>
    </div>
  );
};

export default AppMarketFunnelPage;
