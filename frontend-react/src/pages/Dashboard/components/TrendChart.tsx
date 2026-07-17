/**
 * 趋势图组件
 * 展示成本趋势数据，支持指标类型切换
 */
import React, { useEffect, useState, useMemo } from 'react';
import { Radio, Card, Spin } from 'antd';
import type { EChartsOption } from 'echarts';
import EChartsComponent from '@/components/Chart/ECharts';
import type { TrendDataItem } from '@/types';
import { pickEChartsColor } from '@/utils/echartsColors';
import styles from './TrendChart.module.scss';

// 扩展指标类型，支持更多指标
export type MetricType =
  | 'cost_split'
  | 'cost_per_wechat_lead'
  | 'cost_per_app_activation'
  | 'cost_per_customer'
  | 'cost_per_valid_account'
  | 'investment'
  | 'impressions'
  | 'clicks'
  | 'leads'
  | 'leads_wechat'
  | 'leads_app'
  | 'new_customers'
  | 'valid_customers';

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
  cost_split: '线索成本对比',
  cost_per_wechat_lead: '企微成本',
  cost_per_app_activation: 'APP下载激活成本',
  cost_per_customer: '开户成本',
  cost_per_valid_account: '有效户成本',
  investment: '阶段投入',
  impressions: '展示数',
  clicks: '点击数',
  leads: '线索数',
  leads_wechat: '企微数',
  leads_app: 'APP下载激活数',
  new_customers: '新开客户',
  valid_customers: '有效户',
};

// 指标分组配置
const METRIC_GROUPS = [
  {
    label: '📊 前端投放',
    metrics: ['investment', 'impressions', 'leads_wechat', 'leads_app'] as MetricType[],
  },
  {
    label: '💼 后端转化',
    metrics: ['new_customers', 'valid_customers'] as MetricType[],
  },
  {
    label: '⚡ 运营效率',
    metrics: ['cost_split', 'cost_per_wechat_lead', 'cost_per_app_activation', 'cost_per_customer', 'cost_per_valid_account'] as MetricType[],
  },
];

// 是否为货币类型的指标
const CURRENCY_METRICS: MetricType[] = [
  'cost_split',
  'cost_per_wechat_lead',
  'cost_per_app_activation',
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

  // 构建 ECharts 配置
  const echartsOption = useMemo((): EChartsOption => {
    // 提取所有日期和类别
    const allDates = [...new Set(data.map(item => item.date))].sort();
    const categories = [...new Set(data.map(item => item.category).filter(Boolean))];

    // 构建系列数据
    const seriesData: Record<string, { date: string; value: number }[]> = {};
    data.forEach(item => {
      const cat = item.category || 'default';
      if (!seriesData[cat]) {
        seriesData[cat] = [];
      }
      seriesData[cat].push({ date: item.date, value: item.value });
    });

    // 为每个类别创建一个系列
    const isCostSplit = localMetricType === 'cost_split';
    const series = categories.length > 0
      ? categories.map(cat => ({
          name: cat,
          type: 'line' as const,
          smooth: true, // 平滑曲线
          data: allDates.map(date => {
            const item = seriesData[cat]?.find(d => d.date === date);
            return item?.value ?? null;
          }),
          symbol: 'circle',
          symbolSize: 6,
          itemStyle: {
            color: pickEChartsColor(categories.indexOf(cat)),
          },
          connectNulls: true, // 连接空值
          lineStyle: {
            color: pickEChartsColor(categories.indexOf(cat)),
            width: 2,
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: pickEChartsColor(categories.indexOf(cat)) + '4D' },
                { offset: 1, color: pickEChartsColor(categories.indexOf(cat)) + '00' },
              ],
            },
          },
        }))
      : isCostSplit
        ? [
            // 线索成本对比：2 条线，从 _derived.cost_wechat / _derived.cost_app 取值
            {
              name: '单企微成本',
              type: 'line' as const,
              smooth: true,
              data: allDates.map(date => {
                const item = data.find(d => d.date === date);
                return item?._derived?.cost_wechat ?? null;
              }),
              symbol: 'circle',
              symbolSize: 6,
              itemStyle: { color: pickEChartsColor(0) },
              connectNulls: true,
              lineStyle: { color: pickEChartsColor(0), width: 2 },
            },
            {
              name: '单APP下载激活成本',
              type: 'line' as const,
              smooth: true,
              data: allDates.map(date => {
                const item = data.find(d => d.date === date);
                return item?._derived?.cost_app ?? null;
              }),
              symbol: 'circle',
              symbolSize: 6,
              itemStyle: { color: pickEChartsColor(1) },
              connectNulls: true,
              lineStyle: { color: pickEChartsColor(1), width: 2 },
            },
          ]
        : [{
          name: METRIC_LABELS[localMetricType],
          type: 'line' as const,
          smooth: true, // 平滑曲线
          data: allDates.map(date => {
            const item = data.find(d => d.date === date);
            return item?.value ?? null;
          }),
          symbol: 'circle',
          symbolSize: 6,
          itemStyle: {
            color: pickEChartsColor(0),
          },
          connectNulls: true,
          lineStyle: {
            color: pickEChartsColor(0),
            width: 2,
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: pickEChartsColor(0) + '4D' },
                { offset: 1, color: pickEChartsColor(0) + '00' },
              ],
            },
          },
        }];

    return {
      tooltip: {
        trigger: 'axis',
        showContent: true,
        confine: true,
        formatter: (params: any) => {
          if (!params || params.length === 0) return '';
          const dateStr = params[0].axisValue;
          let html = `<div style="font-weight:bold;margin-bottom:4px;">日期：${dateStr}</div>`;
          params.forEach((param: any) => {
            if (param.value !== null && param.value !== undefined) {
              const label = (categories.length > 0 || isCostSplit) ? param.seriesName : METRIC_LABELS[localMetricType];
              html += `<div>${label}: ${formatValue(param.value)}</div>`;
            }
          });
          return html;
        },
      },
      legend: {
        show: isCostSplit, // 线索成本对比时显示图例区分两条线
      },
      xAxis: {
        type: 'category',
        data: allDates,
        axisLabel: {
          rotate: allDates.length > 30 ? 45 : 0,
        },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: (value: number) => {
            if (CURRENCY_METRICS.includes(localMetricType)) {
              return `¥${value.toLocaleString()}`;
            }
            return value.toLocaleString();
          },
        },
      },
      series,
      grid: {
        left: '3%',
        right: '4%',
        bottom: 10,
        top: 10,
        containLabel: true,
      },
      // 隐藏底部缩放控件，只保留鼠标悬浮、坐标轴、曲线等基础功能
      dataZoom: [],
      // 显式禁用时间轴（播放按钮和进度条）
      timeline: {
        show: false,
      },
    };
  }, [data, localMetricType]);

  const renderControls = () => {
    if (!showControls) return null;

    return (
      <div className={styles.chartControls}>
        {/* 指标分组切换 */}
        {METRIC_GROUPS.map((group) => (
          <div key={group.label} className={styles.metricGroup}>
            <span className={styles.metricGroupLabel}>{group.label}</span>
            <Radio.Group
              value={localMetricType}
              onChange={(e) => handleMetricTypeChange(e.target.value)}
              size="small"
              optionType="button"
              buttonStyle="solid"
            >
              {group.metrics.map((metric) => (
                <Radio.Button key={metric} value={metric}>
                  {METRIC_LABELS[metric]}
                </Radio.Button>
              ))}
            </Radio.Group>
          </div>
        ))}

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
      </div>
    );
  };

  return (
    <Card
      className={styles.trendCard}
      size="small"
    >
      <Spin spinning={loading}>
        {/* 图表标题和控制栏 */}
        <div className={styles.chartHeader}>
          <div className={styles.chartTitleGroup}>
            <h3 className={styles.chartTitle}>📈 趋势分析</h3>
            <span className={styles.chartDesc}>指标变化趋势</span>
          </div>
          {renderControls()}
        </div>

        {/* 图表主体 */}
        <div style={{ height }}>
          {data.length > 0 ? (
            <EChartsComponent option={echartsOption} height={height} />
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
