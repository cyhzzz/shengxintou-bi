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
import { AimOutlined, BankOutlined, CheckCircleOutlined, EyeOutlined, MessageOutlined, MobileOutlined, TeamOutlined, UserOutlined } from '@ant-design/icons';
import { FunnelChart } from '@/components';
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
  const [appmarketStages, setAppmarketStages] = useState<FunnelStage[]>([]);

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
      opened: find('成功开户'),
      valid: find('有效户'),
    };
  }, [contentStages]);

  const appmarketMetrics = useMemo(() => {
    if (!appmarketStages.length) return null;
    const find = (name: string) => appmarketStages.find((s) => s.step === name)?.value || 0;
    return {
      activate: find('激活APP'),
      opened: find('开户成功'),
      deposit: find('入金'),
      valid: find('有效户'),
    };
  }, [appmarketStages]);

  return (
    <div className={styles.page}>
      <Spin spinning={loading}>
        {/* v3.1.4: 筛选器 — 日期范围 + 平台多选 */}
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
            <span style={{ color: 'var(--color-text-tertiary)', fontSize: 12 }}>
              当前只针对 内容平台 / 应用市场 两套独立漏斗加载；选中平台仅受后端 现有 platforms 参数限制。
            </span>
          </Space>
        </Card>

        {/* v3.1: Tab 切换两套独立漏斗 */}
        <Tabs
          defaultActiveKey="content"
          items={[
            {
              key: 'content',
              label: <span><Tag color="blue">内容平台漏斗</Tag> (小红书/腾讯/抖音/快手)</span>,
              children: (
                <Row gutter={[16, 16]}>
                  {/* 核心指标 */}
                  {contentMetrics && (
                    <Col span={24}>
                      <MetricSection title="内容平台核心指标" description="线索、开口到有效户的核心转化表现（v3.1.4 起从客户线索起步；曝光 / 点击仍见下方漏斗 7 阶段）">
                        <MetricCard
                          title="客户线索"
                          value={contentMetrics.leads}
                          valueColor="var(--color-brand)"
                          icon={<UserOutlined style={{ color: 'var(--color-brand)' }} />}
                          description={`内容平台引流线索数`}
                          showWowChange={false}
                        />
                        <MetricCard
                          title="客户开口"
                          value={contentMetrics.mouth}
                          valueColor="var(--chart-color-7)"
                          icon={<MessageOutlined style={{ color: 'var(--chart-color-7)' }} />}
                          description={`线索中已沟通开口的客户数`}
                          showWowChange={false}
                        />
                        <MetricCard
                          title="有效户"
                          value={contentMetrics.valid}
                          valueColor="var(--color-success)"
                          icon={<CheckCircleOutlined style={{ color: 'var(--color-success)' }} />}
                          description={`有效户数·入金且资产达标`}
                          showWowChange={false}
                        />
                      </MetricSection>
                    </Col>
                  )}
                  {/* 漏斗图 */}
                  <Col span={24}>
                    <Card title="7 阶段转化漏斗" size="small">
                      {contentStages.length ? (
                        <FunnelChart data={contentFunnelData} height={520} />
                      ) : (
                        <Empty description="无数据" />
                      )}
                    </Card>
                  </Col>
                  {/* 阶段明细 */}
                  <Col span={24}>
                    <Card title="阶段转化详情" size="small">
                      <div className={styles.stageList}>
                        {contentStages.map((s, idx) => (
                          <div key={s.step} className={styles.stageItem}>
                            <Tag color="blue">{idx + 1}. {s.step}</Tag>
                            <span className={styles.stageValue}>{s.value.toLocaleString()}</span>
                            <Tag color={s.rate > 50 ? 'green' : s.rate > 10 ? 'gold' : 'default'}>
                              累计 {s.rate.toFixed(2)}%
                            </Tag>
                          </div>
                        ))}
                      </div>
                    </Card>
                  </Col>
                </Row>
              ),
            },
            {
              key: 'appmarket',
              label: <span><Tag color="purple">应用市场漏斗</Tag> (小米/华为/OPPO/VIVO/荣耀/苹果)</span>,
              children: (
                <Row gutter={[16, 16]}>
                  {appmarketMetrics && (
                    <Col span={24}>
                      <MetricSection title="应用市场核心指标" description="激活、开户、入金与有效户核心表现">
                        <MetricCard
                          title="激活APP"
                          value={appmarketMetrics.activate}
                          valueColor="var(--color-brand)"
                          icon={<MobileOutlined style={{ color: 'var(--color-brand)' }} />}
                          description={`应用市场激活 APP 数`}
                          showWowChange={false}
                        />
                        <MetricCard
                          title="开户成功"
                          value={appmarketMetrics.opened}
                          valueColor="var(--chart-color-7)"
                          icon={<TeamOutlined style={{ color: 'var(--chart-color-7)' }} />}
                          description={`激活后成功开户人数`}
                          showWowChange={false}
                        />
                        <MetricCard
                          title="入金"
                          value={appmarketMetrics.deposit}
                          valueColor="var(--chart-color-5)"
                          icon={<BankOutlined style={{ color: 'var(--chart-color-5)' }} />}
                          description={`开户后首笔入金人数`}
                          showWowChange={false}
                        />
                        <MetricCard
                          title="有效户"
                          value={appmarketMetrics.valid}
                          valueColor="var(--color-success)"
                          icon={<CheckCircleOutlined style={{ color: 'var(--color-success)' }} />}
                          description={`有效户数·入金且资产达标`}
                          showWowChange={false}
                        />
                      </MetricSection>
                    </Col>
                  )}
                  <Col span={24}>
                    <Card title="8 阶段转化漏斗（应用市场口径）" size="small">
                      {appmarketStages.length ? (
                        <FunnelChart data={appmarketFunnelData} height={520} />
                      ) : (
                        <Empty description="无数据" />
                      )}
                    </Card>
                  </Col>
                  <Col span={24}>
                    <Card title="阶段转化详情" size="small">
                      <div className={styles.stageList}>
                        {appmarketStages.map((s, idx) => (
                          <div key={s.step} className={styles.stageItem}>
                            <Tag color="purple">{idx + 1}. {s.step}</Tag>
                            <span className={styles.stageValue}>{s.value.toLocaleString()}</span>
                            <Tag color={s.rate > 30 ? 'green' : s.rate > 5 ? 'gold' : 'default'}>
                              累计 {s.rate.toFixed(2)}%
                            </Tag>
                          </div>
                        ))}
                      </div>
                    </Card>
                  </Col>
                </Row>
              ),
            },
          ]}
        />

        <ReportFooter
          sources={[
            { label: '内容平台漏斗', value: 'agg_vendor_daily(平台∈内容平台) + fact_conv_content（7 阶段：广告曝光 → 客户点击 → 客户线索 → 客户开口 → 有效线索 → 成功开户 → 有效户）' },
            { label: '应用市场漏斗', value: 'fact_conv_appmarket（8 阶段：激活APP → 开户注册 → 注册身份证 → 注册银行卡 → 提交开户 → 开户成功 → 入金 → 有效户）' },
            { label: '端点', value: 'POST /api/v1/conversion-funnel/split' },
          ]}
          notes={'双漏斗互为独立数据源，按渠道类别拆分。占比由前端按响应数据实时算 (value/previous)。v3.1 默认走 split，旧 is_employee_mode 单端点已弃用 (v3.2 删除)。'}
        />
      </Spin>
    </div>
  );
};

export default ConversionFunnelPage;
