/**
 * 应用市场 · 获客漏斗（v3.1 子报表 1/4）
 * 数据源: fact_conv_appmarket
 * 漏斗: 下载 → 激活APP → 开户注册 → 注册身份证 → 注册银行卡 → 提交开户 → 开户成功 → 新开户 → 入金 → 有效户
 */
import React, { useEffect, useMemo } from 'react';
import { Card, Row, Col, Spin, Tag } from 'antd';
import { CheckCircleOutlined, MobileOutlined, RiseOutlined, TeamOutlined } from '@ant-design/icons';
import { FunnelChart } from '@/components/Chart';
import { ReportFooter } from '@/components/ReportFooter';
import { MetricCard, MetricSection } from '@/components/MetricCard';
import { FadeInSection, FilterBar } from '@/components';

import { dataServiceReports } from '@/services/dataService';
import { useFilterStore } from '@/stores';
import { useReportData } from '@/hooks/useReportData';
import styles from './index.module.scss';

interface AppMarketFilters {
  start_date: string;
  end_date: string;
  app_markets?: string[];
}

const fetchAppMarketSummary = async (filters: AppMarketFilters) => {
  const res: any = await dataServiceReports.getAppMarketSummary(filters);
  if (!res?.success || !res.data) throw new Error(res?.message || '加载应用市场漏斗失败');
  return res.data;
};

const AppMarketFunnelPage: React.FC = () => {
  const { dateRange, selectedAppMarkets } = useFilterStore();
  const { data, loading, load } = useReportData(fetchAppMarketSummary, { errorMessage: '加载应用市场漏斗失败' });

  const filters = useMemo(() => ({
    start_date: dateRange.startDate,
    end_date: dateRange.endDate,
    app_markets: selectedAppMarkets.length ? selectedAppMarkets : undefined,
  }), [dateRange, selectedAppMarkets]);

  useEffect(() => { load(filters); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filters]);

  const total = data?.total_counts || {};
  const funnel = data?.total_funnel || [];
  const downloads = total['激活APP'] || 0; // 用激活APP 作为漏斗顶端基数
  const validCount = total['有效户'] || 0;
  const newOpenCount = total['新开户'] || 0;
  const newOpenAssets = total['新开户资产'] || 0;

  return (
    <div className={styles.page}>
      <FadeInSection delay={0} duration={0.8}>
        <FilterBar showPlatform={false} showAgency={false} showAppMarket onSearch={() => load(filters)} />
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
