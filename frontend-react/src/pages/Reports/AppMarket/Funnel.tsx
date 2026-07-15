/**
 * 应用市场 · 获客漏斗（v3.1 子报表 1/4）
 * 数据源: fact_conv_appmarket
 * 漏斗: 下载 → 激活APP → 开户注册 → 注册身份证 → 注册银行卡 → 提交开户 → 开户成功 → 新开户 → 入金 → 有效户
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Card, Row, Col, Select, DatePicker, Space, Spin, Tag, Button } from 'antd';
import { BankOutlined, CheckCircleOutlined, MobileOutlined, ReloadOutlined, RiseOutlined, TeamOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { FunnelChart } from '@/components/Chart';
import { ReportFooter } from '@/components/ReportFooter';
import { MetricCard, MetricSection } from '@/components/MetricCard';

import { dataServiceReports } from '@/services/dataService';
import styles from './index.module.scss';

const { RangePicker } = DatePicker;

const AppMarketFunnelPage: React.FC = () => {
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([dayjs('2026-01-01'), dayjs('2026-12-31')]);
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
        <MetricSection title="应用市场获客概览" description="激活、开户、入金、有效户与整体转化率">
          <MetricCard
            title="激活APP"
            value={downloads}
            valueColor="var(--color-brand)"
            icon={<MobileOutlined style={{ color: 'var(--color-brand)' }} />}
            showWowChange={false}
          />
          <MetricCard
            title="开户成功"
            value={openCount}
            valueColor="var(--chart-color-7)"
            icon={<TeamOutlined style={{ color: 'var(--chart-color-7)' }} />}
            showWowChange={false}
          />
          <MetricCard
            title="入金"
            value={depositCount}
            valueColor="var(--chart-color-5)"
            icon={<BankOutlined style={{ color: 'var(--chart-color-5)' }} />}
            showWowChange={false}
          />
          <MetricCard
            title="有效户"
            value={validCount}
            valueColor="var(--color-success)"
            icon={<CheckCircleOutlined style={{ color: 'var(--color-success)' }} />}
            showWowChange={false}
          />
          <MetricCard
            title="激活→有效"
            value={overallRate}
            formatter="percent"
            valueColor="var(--color-error)"
            icon={<RiseOutlined style={{ color: 'var(--color-error)' }} />}
            showWowChange={false}
          />
        </MetricSection>

        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Card title='9 阶段漏斗图' size='small'>
              <FunnelChart data={funnel.map((s: any) => ({ name: s.step, count: Number(s.count || 0), rate: Number(s.step_rate || 0) }))} height={500} />
            </Card>
          </Col>
          <Col span={24}>
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

        <ReportFooter
          sources={[
            { label: '数据源', value: 'fact_conv_appmarket（8 阶段：激活APP → 开户注册 → 注册身份证 → 注册银行卡 → 提交开户 → 开户成功 → 入金 → 有效户）' },
            { label: '端点', value: 'POST /api/v1/reports/app-market/summary' },
            { label: '漏斗顶端', value: '激活APP人数（衡量获客容量）' },
          ]}
          notes={'总体转化率 = 有效户 / 激活APP；阶段转化率 = 当前阶段 / 上一阶段，由后端返回的 step_rate / rate 字段提供。'}
        />
      </Spin>
    </div>
  );
};

export default AppMarketFunnelPage;
