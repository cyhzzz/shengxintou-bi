/**
 * 转化漏斗页面
 * 展示从曝光到开户的转化漏斗分析
 * 支持5层漏斗(服务人员模式)和7层漏斗(广告投放模式)
 *
 * 使用 Ant Design 标准样式和配色
 */
import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Spin, message, Select, Space, Statistic, Progress, Typography, Divider, Tag } from 'antd';
import { FilterBar, ChartCard, FunnelChart } from '@/components';
import { dataService } from '@/services';
import styles from './ConversionFunnel.module.scss';

const { Option } = Select;
const { Text } = Typography;

// 漏斗阶段数据类型
interface FunnelStage {
  step: string;
  value: number;
  rate: number;
}

// 核心指标数据类型
interface CoreMetrics {
  cost: number;
  lead_users: number;
  opened_account_users: number;
  valid_customer_users: number;
}

// API响应数据类型
interface ConversionFunnelData {
  funnel: FunnelStage[];
  core_metrics: CoreMetrics;
  is_employee_mode: boolean;
}

// 平台转化数据
interface PlatformConversion {
  platform: string;
  impressions: number;
  clicks: number;
  leads: number;
  customers: number;
  opened_accounts: number;
  valid_customers: number;
}

const ConversionFunnelPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [funnelData, setFunnelData] = useState<FunnelStage[]>([]);
  const [coreMetrics, setCoreMetrics] = useState<CoreMetrics | null>(null);
  const [isEmployeeMode, setIsEmployeeMode] = useState(false);
  const [platformData, setPlatformData] = useState<PlatformConversion[]>([]);
  const [dimension, setDimension] = useState<'platform' | 'agency' | 'business_model'>('platform');

  // 计算合并转化率
  const getCombinedRates = () => {
    if (!funnelData || funnelData.length === 0) return null;

    // 通过阶段名称查找数据，避免索引偏移问题
    const findStageValue = (names: string[]): number => {
      for (const name of names) {
        const stage = funnelData.find(s =>
          s.step === name || s.step.includes(name)
        );
        if (stage) return stage.value;
      }
      return 0;
    };

    if (isEmployeeMode) {
      // 服务人员模式（5层漏斗）
      const leadUsers = findStageValue(['客户线索', '线索']);       // 客户线索
      const openedUsers = findStageValue(['成功开户', '开户']);     // 成功开户
      const validUsers = findStageValue(['有效户']);      // 有效户

      return {
        leadToOpenRate: leadUsers > 0 ? (openedUsers / leadUsers * 100) : 0,
        openToValidRate: openedUsers > 0 ? (validUsers / openedUsers * 100) : 0,
        overallRate: leadUsers > 0 ? (validUsers / leadUsers * 100) : 0,
      };
    } else {
      // 广告投放模式（7层漏斗）
      const impressions = findStageValue(['广告曝光', '曝光']);     // 广告曝光
      const leadUsers = findStageValue(['客户线索', '线索']);       // 客户线索
      const openedUsers = findStageValue(['成功开户', '开户']);     // 成功开户
      const validUsers = findStageValue(['有效户']);      // 有效户

      return {
        impressionToLeadRate: impressions > 0 ? (leadUsers / impressions * 100) : 0,
        leadToOpenRate: leadUsers > 0 ? (openedUsers / leadUsers * 100) : 0,
        openToValidRate: openedUsers > 0 ? (validUsers / openedUsers * 100) : 0,
        overallRate: impressions > 0 ? (validUsers / impressions * 100) : 0,
      };
    }
  };

  // 加载数据
  const loadData = async (filters?: {
    startDate: string;
    endDate: string;
    platforms: string[];
    agencies: string[];
    businessModels: string[];
    employees: string[];
  }) => {
    setLoading(true);
    try {
      const filterParams = filters
        ? {
            start_date: filters.startDate,
            end_date: filters.endDate,
            platforms: filters.platforms,
            agencies: filters.agencies,
            business_models: filters.businessModels,
            employees: filters.employees,
          }
        : undefined;

      const response = await dataService.getConversionFunnel(filterParams);

      if (response.success && response.data) {
        const data = response.data as ConversionFunnelData;

        // 设置漏斗数据
        setFunnelData(data.funnel || []);

        // 设置核心指标
        setCoreMetrics(data.core_metrics || null);

        // 设置模式标识
        setIsEmployeeMode(data.is_employee_mode || false);

        // 设置平台数据 (API 可能返回 by_platform 字段)
        const responseData = response.data as typeof response.data & {
          by_platform?: PlatformConversion[];
        };
        if (responseData.by_platform) {
          setPlatformData(responseData.by_platform);
        }
      }
    } catch (error) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 初始加载
  useEffect(() => {
    loadData();
  }, []);

  // 筛选器查询
  const handleSearch = (filters: Parameters<typeof loadData>[0]) => {
    loadData(filters);
  };

  // 筛选器重置
  const handleReset = () => {
    loadData();
  };

  // 格式化金额
  const formatCost = (value: number) => {
    return `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // 获取合并转化率数据
  const combinedRates = getCombinedRates();

  return (
    <div className={styles.conversionFunnelPage}>
      <Spin spinning={loading}>
        {/* 筛选器 */}
        <FilterBar
          showPlatform
          showAgency
          showBusinessModel
          showEmployee
          onSearch={handleSearch}
          onReset={handleReset}
        />

        {/* 核心指标卡片 */}
        {coreMetrics && (
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            {!isEmployeeMode && (
              <Col xs={12} sm={6}>
                <Card size="small" className={styles.metricCard}>
                  <Statistic
                    title="投入金额"
                    value={coreMetrics.cost}
                    precision={2}
                    prefix="¥"
                    valueStyle={{ color: '#1890ff', fontSize: 20 }}
                  />
                </Card>
              </Col>
            )}
            <Col xs={12} sm={isEmployeeMode ? 8 : 6}>
              <Card size="small" className={styles.metricCard}>
                <Statistic
                  title="新增线索"
                  value={coreMetrics.lead_users}
                  valueStyle={{ color: '#1890ff', fontSize: 20 }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={isEmployeeMode ? 8 : 6}>
              <Card size="small" className={styles.metricCard}>
                <Statistic
                  title="新开客户数"
                  value={coreMetrics.opened_account_users}
                  valueStyle={{ color: '#1890ff', fontSize: 20 }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={isEmployeeMode ? 8 : 6}>
              <Card size="small" className={styles.metricCard}>
                <Statistic
                  title="新增有效户数"
                  value={coreMetrics.valid_customer_users}
                  valueStyle={{ color: '#52c41a', fontSize: 20 }}
                />
              </Card>
            </Col>
          </Row>
        )}

        {/* 漏斗图和转化率数据 */}
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card title="转化率数据" className={styles.detailCard}>
              <div className={styles.funnelTable}>
                {funnelData.map((stage, index) => {
                  const nextStage = funnelData[index + 1];
                  const nextStepRate = nextStage && stage.value > 0
                    ? (nextStage.value / stage.value * 100)
                    : null;

                  return (
                    <div key={stage.step} className={styles.funnelStageItem}>
                      <div className={styles.funnelRow}>
                        <div className={styles.stageInfo}>
                          <Tag color="blue">{stage.step}</Tag>
                          <Text strong className={styles.stageRate}>
                            {(stage.rate || 0).toFixed(2)}%
                          </Text>
                        </div>
                        <div className={styles.progressSection}>
                          <Progress
                            percent={Math.min(stage.rate || 0, 100)}
                            showInfo={false}
                            strokeColor={{
                              '0%': '#1890ff',
                              '100%': '#096dd9',
                            }}
                            trailColor="#f0f2f5"
                            size="small"
                          />
                        </div>
                        <Text type="secondary" className={styles.stageCount}>
                          {stage.value.toLocaleString()} 人
                        </Text>
                      </div>
                      {nextStepRate !== null && (
                        <div className={styles.nextStepRate}>
                          <Text type="secondary">
                            ↓ 至 {nextStage.step}: <Text strong>{nextStepRate.toFixed(2)}%</Text>
                          </Text>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <ChartCard title="转化漏斗" loading={loading} height={400}>
              <FunnelChart data={funnelData.map(s => ({
                name: s.step,
                count: s.value,
                rate: s.rate,
                conversionRate: s.rate
              }))} height={380} />
            </ChartCard>

            {/* 合并转化率 */}
            {combinedRates && (
              <Card
                title={<Text strong style={{ color: '#1890ff' }}>合并转化率</Text>}
                className={styles.combinedRatesCard}
                style={{ marginTop: 16 }}
                size="small"
              >
                <div className={styles.combinedRates}>
                  {'impressionToLeadRate' in combinedRates && (
                    <div className={styles.rateItem}>
                      <Text type="secondary">曝光-线索率</Text>
                      <Text strong style={{ color: '#1890ff' }}>
                        {combinedRates.impressionToLeadRate?.toFixed(2)}%
                      </Text>
                    </div>
                  )}
                  <div className={styles.rateItem}>
                    <Text type="secondary">线索-开户率</Text>
                    <Text strong style={{ color: '#1890ff' }}>
                      {combinedRates.leadToOpenRate.toFixed(2)}%
                    </Text>
                  </div>
                  <div className={styles.rateItem}>
                    <Text type="secondary">开户-有效户率</Text>
                    <Text strong style={{ color: '#1890ff' }}>
                      {combinedRates.openToValidRate.toFixed(2)}%
                    </Text>
                  </div>
                  <Divider style={{ margin: '8px 0' }} />
                  <div className={styles.rateItem}>
                    <Text type="secondary">全链路转化率</Text>
                    <Text strong style={{ color: '#52c41a', fontSize: 16 }}>
                      {combinedRates.overallRate.toFixed(2)}%
                    </Text>
                  </div>
                </div>
              </Card>
            )}
          </Col>
        </Row>

        {/* 平台对比表格 */}
        {platformData.length > 0 && (
          <Row gutter={[16, 16]} className={styles.tableRow}>
            <Col span={24}>
              <Card
                title={
                  <Space>
                    <span>平台转化对比</span>
                    <Select
                      value={dimension}
                      onChange={setDimension}
                      style={{ width: 120 }}
                      size="small"
                    >
                      <Option value="platform">按平台</Option>
                      <Option value="agency">按代理商</Option>
                      <Option value="business_model">按业务模式</Option>
                    </Select>
                  </Space>
                }
              >
                <div className={styles.platformTable}>
                  <table>
                    <thead>
                      <tr>
                        <th>平台</th>
                        <th>曝光</th>
                        <th>点击</th>
                        <th>线索</th>
                        <th>开户</th>
                        <th>有效户</th>
                        <th>点击率</th>
                        <th>转化率</th>
                      </tr>
                    </thead>
                    <tbody>
                      {platformData.map(record => {
                        const clickRate = record.impressions > 0
                          ? ((record.clicks / record.impressions) * 100).toFixed(2)
                          : '0.00';
                        const convRate = record.leads > 0
                          ? ((record.opened_accounts / record.leads) * 100).toFixed(2)
                          : '0.00';
                        return (
                          <tr key={record.platform}>
                            <td>{record.platform}</td>
                            <td>{record.impressions?.toLocaleString() || '-'}</td>
                            <td>{record.clicks?.toLocaleString() || '-'}</td>
                            <td>{record.leads?.toLocaleString() || '-'}</td>
                            <td>{record.opened_accounts?.toLocaleString() || '-'}</td>
                            <td>{record.valid_customers?.toLocaleString() || '-'}</td>
                            <td>{clickRate}%</td>
                            <td>{convRate}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </Col>
          </Row>
        )}
      </Spin>
    </div>
  );
};

export default ConversionFunnelPage;