/**
 * 漏斗图组件
 * 基于 @ant-design/charts 封装
 * 用于转化漏斗展示
 *
 * 特性：
 * 1. 使用对数缩放处理大数据差异，避免漏斗太细
 * 2. 显示阶段名称和人数标签
 */
import React, { useMemo } from 'react';
import { Funnel } from '@ant-design/charts';
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

const FunnelChart: React.FC<FunnelChartProps> = ({
  data,
  height = 400,
}) => {
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
        stage: item.name,
        // 使用对数缩放后的值作为显示值
        value: scaledValue,
        // 保留原始值用于显示
        originalValue: item.count,
        rate: item.rate,
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

  const config = useMemo(() => ({
    data: chartData,
    xField: 'stage',
    yField: 'value',
    // 颜色配置
    colorField: 'stage',
    color: colors,
    // 标签配置 - 显示阶段名称和人数
    // G2 5.x / Ant Design Charts 2.x 使用 label 对象配置标签
    label: {
      text: (datum: any) => {
        const count = datum.originalValue ?? datum.value ?? 0;
        return `${datum.stage}\n${count.toLocaleString()} 人`;
      },
      position: 'inside',
      fill: '#fff',
      fontSize: 12,
      fontWeight: 500,
      textAlign: 'center',
      textBaseline: 'middle',
    },
    // 样式配置
    style: {
      stroke: '#fff',
      lineWidth: 2,
    },
    // 提示信息
    tooltip: {
      title: (datum: any) => datum.stage,
      items: [
        {
          field: 'originalValue',
          name: '人数',
          valueFormatter: (v: number) => v?.toLocaleString() + ' 人',
        },
        {
          field: 'rate',
          name: '转化率',
          valueFormatter: (v: number) => (v !== undefined ? v.toFixed(2) + '%' : '-'),
        },
      ],
    },
    // 图例
    legend: false,
    // 动画
    animate: {
      enter: {
        type: 'fadeIn',
      },
    },
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
      <Funnel {...config} />
    </div>
  );
};

export default FunnelChart;