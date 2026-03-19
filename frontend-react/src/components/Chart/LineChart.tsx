/**
 * 折线图组件
 * 基于 ECharts 封装
 */
import React, { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import EChartsComponent from './ECharts';

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
  const echartsOption = useMemo((): EChartsOption => {
    // 提取所有X轴值和系列
    const xValues = [...new Set(data.map(item => item[xField as keyof DataItem]))].sort() as string[];
    const categories = [...new Set(data.map(item => item[seriesField as keyof DataItem]).filter(Boolean))] as string[];

    // 构建系列数据
    const seriesData: Record<string, Record<string, number>> = {};
    data.forEach(item => {
      const cat = (item[seriesField as keyof DataItem] as string) || 'default';
      const xVal = item[xField as keyof DataItem] as string;
      const yVal = item[yField as keyof DataItem] as number;
      if (!seriesData[cat]) {
        seriesData[cat] = {};
      }
      seriesData[cat][xVal] = yVal;
    });

    // 默认颜色
    const defaultColors = ['#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#eb2f96'];
    const colorPalette = colors || defaultColors;

    // 为每个类别创建一个系列
    const series = categories.length > 0
      ? categories.map((cat, index) => ({
          name: cat,
          type: 'line' as const,
          smooth,
          data: xValues.map(x => seriesData[cat]?.[x] ?? null),
          symbol: 'circle',
          symbolSize: 4,
          connectNulls: true,
          itemStyle: {
            color: colorPalette[index % colorPalette.length],
          },
          lineStyle: {
            color: colorPalette[index % colorPalette.length],
          },
        }))
      : [{
          name: '数据',
          type: 'line' as const,
          smooth,
          data: xValues.map(x => {
            const item = data.find(d => d[xField as keyof DataItem] === x);
            return item?.[yField as keyof DataItem] as number ?? null;
          }),
          symbol: 'circle',
          symbolSize: 4,
          connectNulls: true,
          itemStyle: {
            color: colorPalette[0],
          },
          lineStyle: {
            color: colorPalette[0],
          },
        }];

    return {
      tooltip: {
        trigger: 'axis',
        showContent: true,
      },
      legend: {
        data: categories.length > 0 ? categories : ['数据'],
        bottom: 0,
      },
      xAxis: {
        type: 'category',
        data: xValues,
        axisLabel: {
          rotate: xValues.length > 30 ? 45 : 0,
        },
      },
      yAxis: {
        type: 'value',
      },
      series,
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        containLabel: true,
      },
    };
  }, [data, xField, yField, seriesField, smooth, colors]);

  return <EChartsComponent option={echartsOption} height={height} />;
};

export default LineChart;