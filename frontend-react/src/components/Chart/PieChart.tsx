/**
 * 饼图组件
 * 基于 ECharts 封装
 */
import React, { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import EChartsComponent from './ECharts';

interface DataItem {
  type: string;
  value: number;
}

interface PieChartProps {
  data: DataItem[];
  height?: number;
  innerRadius?: number;
  colors?: string[];
  labelVisible?: boolean;
}

const PieChart: React.FC<PieChartProps> = ({
  data,
  height = 300,
  innerRadius = 0.6,
  colors,
  labelVisible = true,
}) => {
  const echartsOption = useMemo((): EChartsOption => {
    // 默认颜色
    const defaultColors = ['#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#eb2f96'];
    const colorPalette = colors || defaultColors;

    // 计算总值用于百分比
    const total = data.reduce((sum, item) => sum + (item.value || 0), 0);

    return {
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const percent = total > 0 ? ((params.value / total) * 100).toFixed(2) : '0.00';
          return `${params.name}<br/>${params.value.toLocaleString()} (${percent}%)`;
        },
      },
      legend: {
        bottom: 0,
        type: 'scroll',
      },
      color: colorPalette,
      series: [
        {
          type: 'pie',
          radius: innerRadius > 0 ? [`${innerRadius * 50}%`, '70%'] : '70%',
          center: ['50%', '45%'],
          data: data.map(item => ({
            name: item.type,
            value: item.value,
          })),
          label: labelVisible
            ? {
                show: true,
                formatter: (params: any) => {
                  const percent = total > 0 ? ((params.value / total) * 100).toFixed(1) : '0.0';
                  return `${params.name}\n${percent}%`;
                },
                position: 'outer',
              }
            : { show: false },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)',
            },
          },
        },
      ],
    };
  }, [data, innerRadius, colors, labelVisible]);

  return <EChartsComponent option={echartsOption} height={height} />;
};

export default PieChart;