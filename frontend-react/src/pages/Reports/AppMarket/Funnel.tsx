/**
 * 应用市场 · 获客漏斗（v3.1 子报表 1/4）
 * 数据源: fact_conv_appmarket
 * 漏斗: 下载 → 激活APP → 开户注册 → 注册身份证 → 注册银行卡 → 提交开户 → 开户成功 → 新开户 → 入金 → 有效户
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Card, Row, Col, Select, DatePicker, Space, Spin, Tag, Button } from 'antd';
import { CheckCircleOutlined, MobileOutlined, ReloadOutlined, RiseOutlined, SearchOutlined, TeamOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { FunnelChart } from '@/components/Chart';
import { ReportFooter } from '@/components/ReportFooter';
import { MetricCard, MetricSection } from '@/components/MetricCard';
import { FadeInSection } from '@/components';

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

  const resetFilters = () => {
    setDateRange([dayjs('2026-01-01'), dayjs('2026-12-31')]);
    setAppMarketFilter([]);
  };

  const load = async () => {
    setLoading(true);
    try {
      const res: any = await dataServiceReports.getAppMarketSummary(filters);
      if (res?.success) setData(res.data);
    } catch (e) {
      console.error('[AppMarket/Funnel] load() exception:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filters]);

  const total = data?.total_counts || {};
  const funnel = data?.total_funnel || [];
  const downloads = total['激活APP'] || 0; // 用激活APP 作为漏斗顶端基数
  const validCount = total['有效户'] || 0;
  const newOpenCount = total['新开户'] || 0;
  const newOpenAssets = total['新开户资产'] || 0;

  return (
    <div className={styles.page}>
      <FadeInSection delay={0} duration={0.8}>
        <Card className={styles.filterCard} size='small'>
          <Space size='middle' wrap>
            <span className={styles.label}>日期区间</span>
            <RangePicker value={dateRange} onChange={(v) => v && v[0] && v[1] && setDateRange([v[0], v[1]])} allowClear={false} />
            <span className={styles.label}>应用市场</span>
            <Select mode='multiple' allowClear placeholder='全部' value={appMarketFilter}
              onChange={setAppMarketFilter} options={opts.app_markets.map((m) => ({ label: m, value: m }))}
              style={{ minWidth: 220 }} maxTagCount='responsive' />
            <Button type="primary" icon={<SearchOutlined />} onClick={load}>查询</Button>
            <Button icon={<ReloadOutlined />} onClick={resetFilters}>重置</Button>
          </Space>
        </Card>
      </FadeInSection>
      <Spin spinning={loading}>
        {/* v3.1.25: 4 卡片概览，核心业务产出导向 */}
        <FadeInSection delay={0.4} duration={0.8}>
          <MetricSection title="应用市场获客概览" description="激活APP / 新开户 / 有效户 / 新开户引进资产（核心业务产出）">
            <MetricCard
              title="激活APP"
              value={downloads}
              valueColor="var(--color-brand)"
              icon={<MobileOutlined style={{ color: 'var(--color-brand)' }} />}
              description={`激活 APP 数量 · 应用市场漏斗顶端基数`}
              showWowChange={false}
            />
            <MetricCard
              title="新开户"
              value={newOpenCount}
              valueColor="var(--chart-color-7)"
              icon={<TeamOutlined style={{ color: 'var(--chart-color-7)' }} />}
              description={`首次开户客户数 · 剔除存量，核心获客产出`}
              showWowChange={false}
            />
            <MetricCard
              title="有效户"
              value={validCount}
              valueColor="var(--color-success)"
              icon={<CheckCircleOutlined style={{ color: 'var(--color-success)' }} />}
              description={`入金且资产达标有效户`}
              showWowChange={false}
            />
            <MetricCard
              title="新开户引进资产"
              value={newOpenAssets}
              formatter="currency"
              valueColor="var(--color-error)"
              icon={<RiseOutlined style={{ color: 'var(--color-error)' }} />}
              description={`新开户客户对应的总资产 · 引进资产是核心业务产出`}
              showWowChange={false}
            />
          </MetricSection>
        </FadeInSection>

        <FadeInSection delay={0.8} duration={0.8}>
          <Row className={styles.funnelSplitRow}>
            <Col span={12} className={styles.funnelSplitCol}>
              <Card title='9 阶段转化漏斗' size='small' className={styles.h100Card}>
                {(() => {
                  const chartData = funnel.map((s: any) => ({ name: s.step, count: Number(s.count || 0), rate: Number(s.step_rate || 0) }));
                  return <FunnelChart data={chartData} height={520} useLogScale />;
                })()}
              </Card>
            </Col>
            <Col span={12} className={styles.funnelSplitCol}>
              <Card title='各阶段转化详情' size='small' className={styles.h100Card}>
                <table className={styles.stageTable}>
                  <thead>
                    <tr>
                      <th className={styles.colNum}>#</th>
                      <th>阶段</th>
                      <th className={styles.colNum}>累计人数</th>
                      <th className={styles.colNum}>阶段转化率</th>
                      <th className={styles.colNum}>累计转化率</th>
                    </tr>
                  </thead>
                  <tbody>
                    {funnel.map((s: any, idx: number) => (
                      <tr key={s.step}>
                        <td className={styles.colNum}>{idx + 1}</td>
                        <td>{s.step}</td>
                        <td className={styles.colNum}>{s.count?.toLocaleString() || 0}</td>
                        <td className={styles.colNum}>
                          <Tag color={s.rate > 30 ? 'green' : s.rate > 5 ? 'gold' : 'default'}>
                            {s.rate?.toFixed(2) || 0}%
                          </Tag>
                        </td>
                        <td className={styles.colNum}>
                          <Tag color={s.step_rate > 30 ? 'green' : s.step_rate > 5 ? 'gold' : 'default'}>
                            {s.step_rate?.toFixed(2) || 0}%
                          </Tag>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </Col>
          </Row>
        </FadeInSection>

        <FadeInSection delay={1.2} duration={0.8}>
          <ReportFooter
            sources={[
              { label: '数据源', value: 'fact_conv_appmarket（9 阶段：激活APP → 开户注册 → 注册身份证 → 注册银行卡 → 提交开户 → 开户成功 → 新开户 → 入金 → 有效户）' },
              { label: '端点', value: 'POST /api/v1/reports/app-market/summary（v3.1.24 起走 _funnel_filters，业务限渠道类型=互联网引流；新开户作为漏斗阶段呈现）' },
              { label: '漏斗顶端', value: '激活APP人数（衡量获客容量）' },
            ]}
            notes={'v3.1.24 业务口径：仅统计 渠道类型=互联网引流；「新开户」作为漏斗阶段（开户成功→新开户）呈现存量剔除（不用 WHERE 过滤，否则是否新开户=1 的设备行前置阶段字段全=1，SUM 后漏斗变平），与转化漏斗页口径完全一致。rate = 此阶段/上一阶段，step_rate = 此阶段/顶端，漏斗采用 log10 映射缓解各级数据偏差过大问题。'}
          />
        </FadeInSection>
      </Spin>
    </div>
  );
};

export default AppMarketFunnelPage;
