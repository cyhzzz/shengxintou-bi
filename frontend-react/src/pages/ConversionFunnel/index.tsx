/**
 * 转化漏斗页面（v3.1 §三 重构）
 *
 * 数据源（双漏斗，per 渠道类别拆分）:
 * - 内容平台漏斗: agg_vendor_daily(平台∈内容平台) + fact_conv_content
 *   阶段: 广告曝光 → 客户点击 → 客户线索 → 客户开口 → 有效线索 → 成功开户 → 有效户
 * - 应用市场漏斗: fact_conv_appmarket
 *   阶段: 激活APP → 开户注册 → 注册身份证 → 注册银行卡 → 提交开户 → 开户成功 → 入金 → 有效户
 *
 * 端点: POST /api/v1/conversion-funnel/split  →  {funnels: {content, appmarket}}
 *
 * 兼容: 旧 is_employee_mode 单端点已弃用，前端默认走 split（v3.2 删除旧响应）
 */
import React, { useState, useEffect, useMemo } from 'react';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { Row, Col, Card, Spin, message, Tabs, Tag, Space, Empty, DatePicker, Select, Button } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import { CheckCircleOutlined, MobileOutlined, RiseOutlined, TeamOutlined, UserOutlined } from '@ant-design/icons';
import { FunnelChart, FadeInSection } from '@/components';
import { ReportFooter } from '@/components/ReportFooter';
import { MetricCard, MetricSection } from '@/components/MetricCard';
import { dataService } from '@/services';
import { sanitizeText } from '@/utils/sanitizeText';
import styles from './ConversionFunnel.module.scss';

interface FunnelStage {
  step: string;
  value: number;
  rate: number;
}

const ConversionFunnelPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [contentStages, setContentStages] = useState<FunnelStage[]>([]);
  const [extraNewOpened, setExtraNewOpened] = useState<number>(0);
  const [contentNewOpenAssets, setContentNewOpenAssets] = useState<number>(0);
  const [appmarketStages, setAppmarketStages] = useState<FunnelStage[]>([]);
  const [appmarketNewOpenAssets, setAppmarketNewOpenAssets] = useState<number>(0);

  // v3.1.10: 全局日期默认值统一为 2026-01-01 ~ 2026-12-31
  const [dateRange, setDateRange] = useState<[string, string]>(['2026-01-01', '2026-12-31']);
  const [platforms, setPlatforms] = useState<string[]>([]);
  // 筛选器可选平台：内容平台 + 应用市场
  const PLATFORM_OPTIONS = [
    { label: '小红书', value: '小红书' },
    { label: '腾讯高类平台', value: '腾讯高类平台' },
    { label: '抖音', value: '抖音' },
    { label: '快手', value: '快手' },
    { label: '小米', value: '小米' },
    { label: '华为', value: '华为' },
    { label: 'OPPO', value: 'OPPO' },
    { label: 'VIVO', value: 'VIVO' },
    { label: '荣耀', value: '荣耀' },
    { label: '苹果', value: '苹果' },
  ];
  // dateRange state 是 string[]，DatePicker 需要 dayjs，转换中间变量
  const dateRangeDayjs: [Dayjs, Dayjs] = [dayjs(dateRange[0]), dayjs(dateRange[1])];
  const loadData = async (override?: { startDate?: string; endDate?: string; platforms?: string[] }) => {
    setLoading(true);
    try {
      const sd = override?.startDate ?? dateRange[0];
      const ed = override?.endDate ?? dateRange[1];
      const pls = override?.platforms ?? platforms;
      const response: any = await dataService.getConversionFunnelSplit({
        start_date: sd,
        end_date: ed,
        platforms: pls.length ? pls : undefined,
      } as any);
      if (response.success && response.data) {
        const funnels = response.data.funnels || {};
        setContentStages(funnels.content?.stages || []);
        setAppmarketStages(funnels.appmarket?.stages || []);
        setExtraNewOpened(funnels.content?.extra_new_opened || 0);
        setContentNewOpenAssets(funnels.content?.new_open_assets || 0);
        setAppmarketNewOpenAssets(funnels.appmarket?.new_open_assets || 0);
      } else {
        message.error(response.message || '加载转化漏斗失败');
      }
    } catch (error) {
      message.error('加载转化漏斗异常');
    } finally {
      setLoading(false);
    }
  };
  const applyFilters = (next: { start?: Dayjs; end?: Dayjs; pls?: string[] }) => {
    if (next.start && next.end) {
      setDateRange([next.start.format('YYYY-MM-DD'), next.end.format('YYYY-MM-DD')]);
    }
    if (next.pls !== undefined) setPlatforms(next.pls);
    loadData({
      startDate: next.start ? next.start.format('YYYY-MM-DD') : undefined,
      endDate: next.end ? next.end.format('YYYY-MM-DD') : undefined,
      platforms: next.pls !== undefined ? next.pls : platforms,
    });
  };
  const resetFilters = () => {
    setDateRange(['2026-01-01', '2026-12-31']);
    setPlatforms([]);
    loadData({ startDate: '2026-01-01', endDate: '2026-12-31', platforms: [] });
  };

  useEffect(() => { loadData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);


  // 转换 stages 给 FunnelChart 组件 (期望 {name, count, rate})
  const contentFunnelData = useMemo(() => {
    return contentStages.map((s) => ({
      name: sanitizeText(s.step),
      count: s.value,
      rate: s.rate,
      conversionRate: s.rate,
    }));
  }, [contentStages]);

  const appmarketFunnelData = useMemo(() => {
    return appmarketStages.map((s) => ({
      name: sanitizeText(s.step),
      count: s.value,
      rate: s.rate,
      conversionRate: s.rate,
    }));
  }, [appmarketStages]);

  // 内容平台核心指标
  const contentMetrics = useMemo(() => {
    if (!contentStages.length) return null;
    const find = (name: string) => contentStages.find((s) => s.step === name)?.value || 0;
    return {
      impressions: find('广告曝光'),
      clicks: find('客户点击'),
      leads: find('客户线索'),
      mouth: find('客户开口'),
      validLead: find('有效线索'),
      newValidLead: find('有效线索(剔除存量)'),
      // 成功开户阶段已经是非存量口径（cq_new 查询）
      opened: find('成功开户'),
      newOpened: find('成功开户'),
      valid: find('有效户'),
      newValid: find('有效户'),
    };
  }, [contentStages]);

  const appmarketMetrics = useMemo(() => {
    if (!appmarketStages.length) return null;
    const find = (name: string) => appmarketStages.find((s) => s.step === name)?.value || 0;
    return {
      activate: find('激活APP'),
      opened: find('开户成功'),
      newOpened: find('新开户'),
      deposit: find('入金'),
      valid: find('有效户'),
    };
  }, [appmarketStages]);

  return (
    <div className={styles.page}>
      <Spin spinning={loading}>
        {/* v3.1.4: 筛选器 — 日期范围 + 平台多选 */}
        <FadeInSection delay={0} duration={0.8}>
          <Card size='small' style={{ marginBottom: 16 }}>
            <Space size={16} wrap>
              <span>日期范围：</span>
              <DatePicker.RangePicker
                value={dateRangeDayjs}
                onChange={(d) => d && d[0] && d[1] && applyFilters({ start: d[0], end: d[1], pls: platforms })}
                allowClear={false}
              />
              <span>平台：</span>
              <Select
                mode='multiple'
                maxTagCount='responsive'
                placeholder='全部平台'
                style={{ minWidth: 220 }}
                value={platforms}
                onChange={(pls) => applyFilters({ start: dateRangeDayjs[0], end: dateRangeDayjs[1], pls })}
                options={PLATFORM_OPTIONS}
                allowClear
              />
              <Button type="primary" icon={<SearchOutlined />} onClick={loadData}>查询</Button>
              <Button icon={<ReloadOutlined />} onClick={resetFilters}>重置</Button>
            </Space>
          </Card>
        </FadeInSection>

        {/* v3.1: Tab 切换两套独立漏斗 */}
        <FadeInSection delay={0.2} duration={0.8}>
          <Tabs
            defaultActiveKey="content"
            items={[
              {
                key: 'content',
                label: <span><Tag color="blue">内容平台漏斗</Tag> (小红书/腾讯/抖音/快手)</span>,
                children: (
                  <Row gutter={[16, 16]}>
                    {/* v3.1.26 问题3: 核心指标参考应用市场概览 4 卡（线索/新开户/有效户/新开户引进资产） */}
                    {contentMetrics && (
                      <Col span={24}>
                        <FadeInSection delay={0.1} duration={0.8}>
                          <MetricSection title="内容平台获客概览" description="线索 / 新开户 / 有效户 / 新开户引进资产（核心业务产出，与应用市场获客概览口径对齐）">
                            <MetricCard
                              title="客户线索"
                              value={contentMetrics.leads}
                              valueColor="var(--color-brand)"
                              icon={<UserOutlined style={{ color: 'var(--color-brand)' }} />}
                              description={`内容平台引流线索数（企微号）· 漏斗顶端基数`}
                              showWowChange={false}
                            />
                            <MetricCard
                              title="新开户"
                              value={contentMetrics.newOpened}
                              valueColor="var(--chart-color-7)"
                              icon={<TeamOutlined style={{ color: 'var(--chart-color-7)' }} />}
                              description={`非存量且成功开户人数 · 剔除存量，核心获客产出`}
                              showWowChange={false}
                            />
                            <MetricCard
                              title="有效户"
                              value={contentMetrics.newValid}
                              valueColor="var(--color-success)"
                              icon={<CheckCircleOutlined style={{ color: 'var(--color-success)' }} />}
                              description={`非存量且有效户人数 · 入金且资产达标`}
                              showWowChange={false}
                            />
                            <MetricCard
                              title="新开户引进资产"
                              value={contentNewOpenAssets}
                              formatter="currency"
                              valueColor="var(--color-error)"
                              icon={<RiseOutlined style={{ color: 'var(--color-error)' }} />}
                              description={`非存量且开户成功客户的总资产 · 引进资产是核心业务产出`}
                              showWowChange={false}
                            />
                          </MetricSection>
                        </FadeInSection>
                      </Col>
                    )}
                    {/* 漏斗图 + 阶段明细 左右等高布局（v3.1.23） */}
                    <Col span={24}>
                      <FadeInSection delay={0.25} duration={0.8}>
                        <Row className={styles.funnelSplitRow}>
                          <Col span={12} className={styles.funnelSplitCol}>
                            <Card title="8 阶段转化漏斗" size="small" className={styles.h100Card}>
                              {contentStages.length ? (
                                <FunnelChart data={contentFunnelData} height={520} useLogScale />
                              ) : (
                                <Empty description="无数据" />
                              )}
                            </Card>
                          </Col>
                          <Col span={12} className={styles.funnelSplitCol}>
                            <Card title="阶段转化详情" size="small" className={styles.h100Card}>
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
                                  {contentStages.map((s, idx) => (
                                    <tr key={s.step}>
                                      <td className={styles.colNum}>{idx + 1}</td>
                                      <td>{sanitizeText(s.step)}</td>
                                      <td className={styles.colNum}>{s.value.toLocaleString()}</td>
                                      <td className={styles.colNum}>
                                        <Tag color={s.rate > 50 ? 'green' : s.rate > 10 ? 'gold' : 'default'}>
                                          {s.rate.toFixed(2)}%
                                        </Tag>
                                      </td>
                                      <td className={styles.colNum}>
                                        <Tag color={s.step_rate > 30 ? 'green' : s.step_rate > 5 ? 'gold' : 'default'}>
                                          {s.step_rate.toFixed(2)}%
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
                    </Col>
                  </Row>
                ),
              },
              {
                key: 'appmarket',
                label: <span><Tag color="purple">应用市场漏斗</Tag> (小米/华为/OPPO/VIVO/荣耀/苹果)</span>,
                children: (
                  <Row gutter={[16, 16]}>
                    {/* v3.1.26 问题3: 应用市场核心指标参考应用市场-获客漏斗概览 4 卡 */}
                    {appmarketMetrics && (
                      <Col span={24}>
                        <FadeInSection delay={0.1} duration={0.8}>
                          <MetricSection title="应用市场获客概览" description="激活APP / 新开户 / 有效户 / 新开户引进资产（核心业务产出，与应用市场-获客漏斗页口径一致）">
                            <MetricCard
                              title="激活APP"
                              value={appmarketMetrics.activate}
                              valueColor="var(--color-brand)"
                              icon={<MobileOutlined style={{ color: 'var(--color-brand)' }} />}
                              description={`激活 APP 数量 · 应用市场漏斗顶端基数`}
                              showWowChange={false}
                            />
                            <MetricCard
                              title="新开户"
                              value={appmarketMetrics.newOpened}
                              valueColor="var(--chart-color-7)"
                              icon={<TeamOutlined style={{ color: 'var(--chart-color-7)' }} />}
                              description={`首次开户客户数 · 剔除存量，核心获客产出`}
                              showWowChange={false}
                            />
                            <MetricCard
                              title="有效户"
                              value={appmarketMetrics.valid}
                              valueColor="var(--color-success)"
                              icon={<CheckCircleOutlined style={{ color: 'var(--color-success)' }} />}
                              description={`入金且资产达标有效户`}
                              showWowChange={false}
                            />
                            <MetricCard
                              title="新开户引进资产"
                              value={appmarketNewOpenAssets}
                              formatter="currency"
                              valueColor="var(--color-error)"
                              icon={<RiseOutlined style={{ color: 'var(--color-error)' }} />}
                              description={`新开户客户对应的总资产 · 引进资产是核心业务产出`}
                              showWowChange={false}
                            />
                          </MetricSection>
                        </FadeInSection>
                      </Col>
                    )}
                    <Col span={24}>
                      <FadeInSection delay={0.25} duration={0.8}>
                        <Row className={styles.funnelSplitRow}>
                          <Col span={12} className={styles.funnelSplitCol}>
                            <Card title="9 阶段转化漏斗（应用市场口径）" size="small" className={styles.h100Card}>
                              {appmarketStages.length ? (
                                <FunnelChart data={appmarketFunnelData} height={520} useLogScale />
                              ) : (
                                <Empty description="无数据" />
                              )}
                            </Card>
                          </Col>
                          <Col span={12} className={styles.funnelSplitCol}>
                            <Card title="阶段转化详情" size="small" className={styles.h100Card}>
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
                                  {appmarketStages.map((s, idx) => (
                                    <tr key={s.step}>
                                      <td className={styles.colNum}>{idx + 1}</td>
                                      <td>{sanitizeText(s.step)}</td>
                                      <td className={styles.colNum}>{s.value.toLocaleString()}</td>
                                      <td className={styles.colNum}>
                                        <Tag color={s.rate > 30 ? 'green' : s.rate > 5 ? 'gold' : 'default'}>
                                          {s.rate.toFixed(2)}%
                                        </Tag>
                                      </td>
                                      <td className={styles.colNum}>
                                        <Tag color={s.step_rate > 30 ? 'green' : s.step_rate > 5 ? 'gold' : 'default'}>
                                          {s.step_rate.toFixed(2)}%
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
                    </Col>
                  </Row>
                ),
              },
            ]}
          />
        </FadeInSection>

        <FadeInSection delay={0.4} duration={0.8}>
          <ReportFooter
            sources={[
              { label: '内容平台漏斗', value: 'agg_vendor_daily(平台∈内容平台) + fact_conv_content（8 阶段：广告曝光 → 客户点击 → 客户线索 → 客户开口 → 有效线索 → 有效线索(剔除存量) → 成功开户 → 有效户）' },
              { label: '应用市场漏斗', value: 'fact_conv_appmarket（9 阶段：激活APP → 开户注册 → 注册身份证 → 注册银行卡 → 提交开户 → 开户成功 → 新开户 → 入金 → 有效户）' },
              { label: '端点', value: 'POST /api/v1/conversion-funnel/split' },
            ]}
            notes={`内容平台漏斗在有效线索后剔除存量客户（是否为存量客户≠1），后续成功开户/有效户仅统计新客户；应用市场漏斗限渠道类型=互联网引流，「新开户」作为开户成功之后的阶段呈现。${extraNewOpened > 0 ? `本周期有 ${extraNewOpened} 位「非有效线索但新开户」客户（未标记有效线索但实际开户成功），导致成功开户数可能大于有效线索(剔除存量)，属业务正常现象。` : ''}漏斗采用对数尺度 (log10) 映射缓解各级数据偏差过大问题；表格与 tooltip 仍显示原始人数。stage.rate = 此阶段/上一阶段、stage.step_rate = 此阶段/顶端。`}
          />
        </FadeInSection>
      </Spin>
    </div>
  );
};

export default ConversionFunnelPage;
