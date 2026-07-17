/**
 * 类型定义和转换函数
 * 导出前端使用的通用类型和数据转换工具
 */

// ============================================
// 趋势数据相关类型
// ============================================

/**
 * 趋势图数据项
 * 用于 Line/Column 图表组件
 */
export interface TrendDataItem {
  /** 日期 */
  date: string;
  /** 数值 */
  value: number;
  /** 分类（可选，用于多系列图表） */
  category?: string;
  /** 派生指标字典（cost_per_*、ctr、cost_wechat、cost_app 等） */
  _derived?: Record<string, number>;
}

/**
 * 数据概览趋势数据
 * 由 transformDashboardTrendData 函数转换后的格式
 */
export interface DashboardTrendData {
  /** 趋势数据数组 */
  trend_data: TrendDataItem[];
  /** 指标类型 */
  metric_type?: string;
}

// ============================================
// 数据转换函数
// ============================================

/**
 * 将 API 响应转换为前端图表数据格式
 *
 * 支持三种 API 响应格式：
 * 1. 新格式: { trend_data: [{date, value}], metric_type }
 * 2. 旧格式: { dates: [], values: [], metric_type }
 * 3. 系列格式: { dates: [], series: [{name, data}], metric_type }
 *
 * @param data - API 返回的原始数据
 * @returns 转换后的趋势数据
 */
export function transformDashboardTrendData(
  data: {
    trend_data?: Array<{ date: string; value: number }>;
    dates?: string[];
    values?: number[];
    series?: Array<{ name: string; data: number[] }>;
    metric_type?: string;
  }
): DashboardTrendData {
  let trend_data: TrendDataItem[];

  // 新格式：trend_data 已经是数组
  if (data.trend_data && Array.isArray(data.trend_data)) {
    trend_data = data.trend_data.map(item => ({
      date: item.date,
      value: item.value ?? 0,
    }));
  }
  // 系列格式：dates + series (多系列数据)
  else if (data.dates && data.series && Array.isArray(data.series)) {
    const dates = data.dates;
    trend_data = [];

    // 将每个系列转换为数据项，带 category 字段
    for (const seriesItem of data.series) {
      const seriesData = seriesItem.data || [];
      for (let i = 0; i < dates.length; i++) {
        trend_data.push({
          date: dates[i],
          value: seriesData[i] ?? 0,
          category: seriesItem.name,
        });
      }
    }
  }
  // 旧格式：需要从 dates 和 values 转换
  else {
    const dates = data.dates || [];
    const values = data.values || [];
    trend_data = dates.map((date, index) => ({
      date,
      value: values[index] ?? 0,
    }));
  }

  return {
    trend_data,
    metric_type: data.metric_type,
  };
}

/**
 * 将 API 响应转换为趋势图数据项数组
 *
 * @param data - API 返回的原始数据
 * @param category - 可选的分类名称
 * @returns 趋势数据项数组
 */
export function transformToTrendDataItems(
  data: {
    dates?: string[];
    values?: number[];
  },
  category?: string
): TrendDataItem[] {
  const dates = data.dates || [];
  const values = data.values || [];

  return dates.map((date, index) => ({
    date,
    value: values[index] ?? 0,
    category,
  }));
}

// ============================================
// 其他通用类型
// ============================================

/**
 * 分页参数
 */
export interface PaginationParams {
  page?: number;
  page_size?: number;
}

/**
 * 分页响应
 */
export interface PaginationResponse {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

/**
 * 环比变化数据
 */
export interface WowChange {
  /** 变化值 */
  value: number;
  /** 趋势方向: up | down | flat */
  trend: 'up' | 'down' | 'flat';
  /** 颜色: green | red | gray */
  color: 'green' | 'red' | 'gray';
}

/**
 * 带环比的指标数据
 */
export interface MetricWithWow {
  /** 当前值 */
  value: number;
  /** 环比变化 */
  wow?: WowChange;
}