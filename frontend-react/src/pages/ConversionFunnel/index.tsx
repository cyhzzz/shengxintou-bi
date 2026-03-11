/**
 * 转化漏斗页面
 * 展示从曝光到开户的转化漏斗分析
 */
import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Spin, message, Select, Space, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { FilterBar, ChartCard, FunnelChart } from '@/components';
import { dataService } from '@/services';
import styles from './ConversionFunnel.module.scss';

const { Option } = Select;

// 漏斗阶段数据类型
interface FunnelStage {
  name: string;
  count: number;
  rate: number;
  conversionRate: number;
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
  const [platformData, setPlatformData] = useState<PlatformConversion[]>([]);
  const [dimension, setDimension] = useState<'platform' | 'agency' | 'business_model'>('platform');

  // 加载数据
  const loadData = async (filters?: {
    startDate: string;
    endDate: string;
    platforms: string[];
    agencies: string[];
    businessModels: string[];
  }) => {
    setLoading(true);
    try {
      const filterParams = filters
        ? {
            start_date: filters.startDate,
            end_date: filters.endDate,
            platforms: filters.platforms,
            agencies: filters.agencies,
          }
        : undefined;

      const response = await dataService.getConversionFunnel(filterParams);

      if (response.success && response.data) {
        const data = response.data;

        // 构建漏斗数据
        const funnel: FunnelStage[] = [
          { name: '曝光', count: data.funnel[0]?.count || 0, rate: 100, conversionRate: 100 },
          { name: '点击', count: data.funnel[1]?.count || 0, rate: 0, conversionRate: 0 },
          { name: '线索', count: data.funnel[2]?.count || 0, rate: 0, conversionRate: 0 },
          { name: '开户', count: data.funnel[3]?.count || 0, rate: 0, conversionRate: 0 },
          { name: '有效户', count: data.funnel[4]?.count || 0, rate: 0, conversionRate: 0 },
        ];

        // 计算转化率
        for (let i = 1; i < funnel.length; i++) {
          funnel[i].rate = funnel[i - 1].count > 0
            ? (funnel[i].count / funnel[i - 1].count) * 100
            : 0;
          funnel[i].conversionRate = funnel[0].count > 0
            ? (funnel[i].count / funnel[0].count) * 100
            : 0;
        }

        setFunnelData(funnel);

        // 设置平台数据
        if (data.by_platform) {
          setPlatformData(data.by_platform);
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

  // 表格列定义
  const columns: ColumnsType<PlatformConversion> = [
    {
      title: '平台',
      dataIndex: 'platform',
      key: 'platform',
      render: (text: string) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: '曝光',
      dataIndex: 'impressions',
      key: 'impressions',
      align: 'right',
      render: (v: number) => v?.toLocaleString() || '-',
    },
    {
      title: '点击',
      dataIndex: 'clicks',
      key: 'clicks',
      align: 'right',
      render: (v: number) => v?.toLocaleString() || '-',
    },
    {
      title: '线索',
      dataIndex: 'leads',
      key: 'leads',
      align: 'right',
      render: (v: number) => v?.toLocaleString() || '-',
    },
    {
      title: '开户',
      dataIndex: 'opened_accounts',
      key: 'opened_accounts',
      align: 'right',
      render: (v: number) => v?.toLocaleString() || '-',
    },
    {
      title: '有效户',
      dataIndex: 'valid_customers',
      key: 'valid_customers',
      align: 'right',
      render: (v: number) => v?.toLocaleString() || '-',
    },
    {
      title: '点击率',
      key: 'click_rate',
      align: 'right',
      render: (_: unknown, record: PlatformConversion) => {
        const rate = record.impressions > 0
          ? ((record.clicks / record.impressions) * 100).toFixed(2)
          : '0.00';
        return `${rate}%`;
      },
    },
    {
      title: '转化率',
      key: 'conversion_rate',
      align: 'right',
      render: (_: unknown, record: PlatformConversion) => {
        const rate = record.leads > 0
          ? ((record.opened_accounts / record.leads) * 100).toFixed(2)
          : '0.00';
        return `${rate}%`;
      },
    },
  ];

  return (
    <div className={styles.conversionFunnelPage}>
      <Spin spinning={loading}>
        {/* 筛选器 */}
        <FilterBar
          showPlatform
          showAgency
          onSearch={handleSearch}
          onReset={handleReset}
        />

        {/* 漏斗图 */}
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <ChartCard title="转化漏斗" loading={loading} height={400}>
              <FunnelChart data={funnelData} height={380} />
            </ChartCard>
          </Col>
          <Col xs={24} lg={12}>
            <Card title="漏斗数据明细" className={styles.detailCard}>
              <div className={styles.funnelTable}>
                {funnelData.map((stage, index) => (
                  <div key={stage.name} className={styles.funnelRow}>
                    <span className={styles.stageName}>{stage.name}</span>
                    <span className={styles.stageCount}>{stage.count.toLocaleString()}</span>
                    <span className={styles.stageRate}>
                      {index > 0 && `${stage.rate.toFixed(2)}%`}
                    </span>
                    <span className={styles.stageConversion}>
                      总转化: {stage.conversionRate.toFixed(2)}%
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </Col>
        </Row>

        {/* 平台对比表格 */}
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
              <Table
                columns={columns}
                dataSource={platformData}
                rowKey="platform"
                pagination={false}
                size="small"
              />
            </Card>
          </Col>
        </Row>
      </Spin>
    </div>
  );
};

export default ConversionFunnelPage;