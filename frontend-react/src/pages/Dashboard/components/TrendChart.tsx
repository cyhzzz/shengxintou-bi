/**
 * 趋势图组件
 * 展示成本趋势数据，支持指标类型切换
 */
import React, { useEffect, useState } from 'react';
import { Line } from '@ant-design/charts';
import { Radio, Space, Card, Spin } from 'antd';
import type { TrendDataItem } from '@/types';
import styles from './TrendChart.module.scss';

// 扩展指标类型，支持更多指标
export type MetricType =
  | 'cost_per_lead'
  | 'cost_per_customer'
  | 'cost_per_valid_account'
  | 'investment'
  | 'impressions'
  | 'clicks'
  | 'leads'
  | 'new_customers';

export type Granularity = 'daily' | 'weekly' | 'monthly';

interface TrendChartProps {
  data: TrendDataItem[];
  metricType?: MetricType;
  loading?: boolean;
  height?: number;
  showControls?: boolean;
  /** 图表标题，默认为"趋势分析" */
  title?: string;
  onMetricTypeChange?: (type: MetricType) => void;
  onGranularityChange?: (granularity: Granularity) => void;
}

// 指标标签映射
const METRIC_LABELS: Record<MetricType, string> = {
  cost_per_lead: '线索成本',
  cost_per_customer: '开户成本',
  cost_per_valid_account: '有效户成本',
  investment: '阶段投入金额',
  impressions: '总展示数',
  clicks: '总点击数',
  leads: '总线索数',
  new_customers: '新开客户数',
};

// 是否为货币类型的指标
const CURRENCY_METRICS: MetricType[] = [
  'cost_per_lead',
  'cost_per_customer',
  'cost_per_valid_account',
  'investment'
];

const GRANULARITY_LABELS: Record<Granularity, string> = {
  daily: '日',
  weekly: '周',
  monthly: '月',
};

const TrendChart: React.FC<TrendChartProps> = ({
  data,
  metricType = 'cost_per_lead',
  loading = false,
  height = 350,
  showControls = true,
  title = '趋势分析',
  onMetricTypeChange,
  onGranularityChange,
}) => {
  const [localMetricType, setLocalMetricType] = useState<MetricType>(metricType);
  const [localGranularity, setLocalGranularity] = useState<Granularity>('daily');

  useEffect(() => {
    setLocalMetricType(metricType);
  }, [metricType]);

  const handleMetricTypeChange = (value: MetricType) => {
    setLocalMetricType(value);
    onMetricTypeChange?.(value);
  };

  const handleGranularityChange = (value: Granularity) => {
    setLocalGranularity(value);
    onGranularityChange?.(value);
  };

  // 格式化数值（根据指标类型）
  const formatValue = (value: number | undefined): string => {
    if (value === undefined || value === null) return '-';
    if (CURRENCY_METRICS.includes(localMetricType)) {
      return `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return value.toLocaleString('zh-CN');
  };

  const config = {
    data,
    xField: 'date',
    yField: 'value',
    seriesField: 'category',
    smooth: true,
    animation: {
      appear: {
        animation: 'path-in',
        duration: 1000,
      },
    },
    point: {
      shape: 'circle',
      size: 4,
    },
    tooltip: {
      // 使用 customItems 自定义 tooltip 内容
      customItems: (originalItems: any[]) => {
        return originalItems.map((item) => ({
          ...item,
          name: METRIC_LABELS[localMetricType] || item.name,
          value: formatValue(item.value),
        }));
      },
    },
    yAxis: {
      label: {
        formatter: (value: number) => {
          if (CURRENCY_METRICS.includes(localMetricType)) {
            return `¥${value.toLocaleString()}`;
          }
          return value.toLocaleString();
        },
      },
    },
    xAxis: {
      label: {
        autoRotate: true,
        autoHide: true,
      },
    },
    legend: {
      position: 'top' as const,
    },
    color: ['#1890ff'],
  };

  const renderControls = () => {
    if (!showControls) return null;

    return (
      <div className={styles.chartControls}>
        <Space size="middle">
          {/* 指标类型切换 */}
          <div className={styles.controlGroup}>
            <span className={styles.controlLabel}>指标:</span>
            <Radio.Group
              value={localMetricType}
              onChange={(e) => handleMetricTypeChange(e.target.value)}
              size="small"
              optionType="button"
              buttonStyle="solid"
            >
              {Object.entries(METRIC_LABELS).map(([key, label]) => (
                <Radio.Button key={key} value={key}>
                  {label}
                </Radio.Button>
              ))}
            </Radio.Group>
          </div>

          {/* 粒度切换 */}
          {onGranularityChange && (
            <div className={styles.controlGroup}>
              <span className={styles.controlLabel}>粒度:</span>
              <Radio.Group
                value={localGranularity}
                onChange={(e) => handleGranularityChange(e.target.value)}
                size="small"
                optionType="button"
                buttonStyle="solid"
              >
                {Object.entries(GRANULARITY_LABELS).map(([key, label]) => (
                  <Radio.Button key={key} value={key}>
                    {label}
                  </Radio.Button>
                ))}
              </Radio.Group>
            </div>
          )}
        </Space>
      </div>
    );
  };

  return (
    <Card
      className={styles.trendCard}
      variant="borderless"
    >
      <Spin spinning={loading}>
        {/* 图表标题和控制栏 */}
        <div className={styles.chartHeader}>
          <h3 className={styles.chartTitle}>{title}</h3>
          {renderControls()}
        </div>

        {/* 图表主体 */}
        <div style={{ height }}>
          {data.length > 0 ? (
            <Line {...config} />
          ) : (
            <div className={styles.emptyState}>
              暂无数据
            </div>
          )}
        </div>
      </Spin>
    </Card>
  );
};

export default TrendChart;