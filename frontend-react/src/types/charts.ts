// 通用图表数据点
export interface ChartDataPoint {
  date: string;
  value: number;
  name?: string;
}

// 多系列图表数据
export interface MultiSeriesChartData {
  dates: string[];
  series: {
    name: string;
    data: number[];
  }[];
}

// 饼图数据
export interface PieChartData {
  name: string;
  value: number;
}

// 漏斗图数据
export interface FunnelChartData {
  stage: string;
  count: number;
  rate: number;
}