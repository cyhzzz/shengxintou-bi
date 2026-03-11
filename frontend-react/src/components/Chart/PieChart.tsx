/**
 * 饼图组件
 * 基于 @ant-design/charts 封装
 */
import React, { useMemo } from 'react';
import { Pie } from '@ant-design/charts';
import type { PieConfig } from '@ant-design/charts/es/pie';

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
  const config: PieConfig = useMemo(
    () => ({
      data,
      height,
      innerRadius,
      color: colors,
      appendPadding: 10,
      angleField: 'value',
      colorField: 'type',
      radius: 0.8,
      label: labelVisible
        ? {
            type: 'outer',
            content: '{name} {percentage}',
          }
        : false,
      interactions: [
        {
          type: 'pie-legend-active',
        },
        {
          type: 'element-active',
        },
      ],
      legend: {
        position: 'bottom',
      },
    }),
    [data, height, innerRadius, colors, labelVisible]
  );

  return <Pie {...config} />;
};

export default PieChart;