/**
 * 漏斗图组件
 * 基于 ECharts 封装
 * 用于转化漏斗展示
 *
 * 特性：
 * 1. 使用对数缩放处理大数据差异，避免漏斗太细
 * 2. 显示阶段名称和人数标签
 */
import React, { useMemo } from 'react';
import type { DefaultLabelFormatterCallbackParams, EChartsOption, TooltipComponentFormatterCallbackParams } from 'echarts';
import EChartsComponent from './ECharts';
import styles from './FunnelChart.module.scss';

interface FunnelStage {
  name: string;
  count: number;
  rate?: number;
  conversionRate?: number;
}

interface FunnelChartProps {
  data: FunnelStage[];
  height?: number;
  showConversionRate?: boolean;
}

interface FunnelParamData {
  name: string;
  rawValue: number;
  rate?: number;
}

const toNumber = (value: unknown) => Number(value || 0);

const readFunnelParam = (params: TooltipComponentFormatterCallbackParams | DefaultLabelFormatterCallbackParams): FunnelParamData => {
  const item = Array.isArray(params) ? params[0] : params;
  const data = (item?.data || {}) as { rawValue?: unknown; rate?: unknown };
  const rate = typeof data.rate === 'number' ? data.rate : undefined;
  return {
    name: String(item?.name || ''),
    rawValue: toNumber(data.rawValue ?? item?.value),
    rate,
  };
};

const FunnelChart: React.FC<FunnelChartProps> = ({
  data,
  height = 400,
}) => {
  const formatNumber = (value: number) => Number(value || 0).toLocaleString();

  // 使用对数缩放处理数据，使漏斗宽度更平滑
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    // 计算对数值用于宽度比例
    const logValues = data.map((d) =>
      d.count > 0 ? Math.log10(d.count + 1) : 0
    );
    const maxLogValue = Math.max(...logValues);

    // 使用对数缩放后的值作为显示值，但保留原始值用于标签
    return data.map((item, index) => {
      const logValue = logValues[index];
      // 对数缩放后的值（用于漏斗宽度）
      const scaledValue = maxLogValue > 0
        ? Math.round((logValue / maxLogValue) * 100)
        : 0;

      return {
        name: item.name,
        // 使用对数缩放后的值作为显示值
        value: scaledValue,
        // 保留原始值用于显示
        rawValue: item.count,
        rate: item.rate ?? item.conversionRate,
        conversionRate: item.conversionRate,
      };
    });
  }, [data]);

  // Ant Design 配色方案
  const colors = useMemo(() => [
    '#1890ff', // Primary Blue
    '#40a9ff',
    '#69c0ff',
    '#91d5ff',
    '#52c41a', // Success Green
    '#faad14', // Warning Orange
    '#ff7a45',
  ], []);

  const option: EChartsOption = useMemo(() => ({
    color: colors,
    tooltip: {
      trigger: 'item',
      formatter: (params: TooltipComponentFormatterCallbackParams) => {
        const { name, rawValue, rate } = readFunnelParam(params);
        return [
          name,
          `人数：${formatNumber(rawValue)} 人`,
          `转化率：${typeof rate === 'number' ? `${rate.toFixed(2)}%` : '-'}`,
        ].join('<br/>');
      },
    },
    series: [{
      name: '转化漏斗',
      type: 'funnel',
      left: '8%',
      top: 24,
      width: '84%',
      height: '86%',
      minSize: '12%',
      maxSize: '100%',
      sort: 'none',
      gap: 4,
      label: {
        show: true,
        position: 'inside',
        color: '#fff',
        fontSize: 12,
        fontWeight: 600,
        formatter: (params: DefaultLabelFormatterCallbackParams) => {
          const { name, rawValue } = readFunnelParam(params);
          return `${name}\n${formatNumber(rawValue)} 人`;
        },
      },
      labelLine: { show: false },
      itemStyle: { borderColor: '#fff', borderWidth: 2 },
      data: chartData,
    }],
  }), [chartData, colors]);

  // 如果没有数据，显示占位
  if (!data || data.length === 0) {
    return (
      <div
        className={styles.funnelChart}
        style={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ color: '#999' }}>暂无数据</span>
      </div>
    );
  }

  return (
    <div className={styles.funnelChart} style={{ height }}>
      <EChartsComponent option={option} height={height} />
    </div>
  );
};

export default FunnelChart;
