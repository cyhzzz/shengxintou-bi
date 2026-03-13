/**
 * 折线图组件
 * 基于 @ant-design/charts 封装
 */
import React, { useMemo } from 'react';
import { Line } from '@ant-design/charts';
import type { LineConfig } from '@ant-design/charts';

interface DataItem {
  date: string;
  value: number;
  category?: string;
}

interface LineChartProps {
  data: DataItem[];
  xField?: string;
  yField?: string;
  seriesField?: string;
  height?: number;
  smooth?: boolean;
  colors?: string[];
}

const LineChart: React.FC<LineChartProps> = ({
  data,
  xField = 'date',
  yField = 'value',
  seriesField = 'category',
  height = 300,
  smooth = true,
  colors,
}) => {
  const config: LineConfig = useMemo(
    () => ({
      data,
      xField,
      yField,
      seriesField,
      smooth,
      height,
      color: colors,
      point: {
        size: 3,
        shape: 'circle',
      },
      tooltip: {
        shared: true,
        showCrosshairs: true,
      },
      legend: {
        position: 'bottom',
      },
      animation: {
        appear: {
          animation: 'path-in',
          duration: 1000,
        },
      },
    }),
    [data, xField, yField, seriesField, smooth, height, colors]
  );

  return <Line {...config} />;
};

export default LineChart;