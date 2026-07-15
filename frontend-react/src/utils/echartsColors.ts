/**
 * ECharts 调色板（与 frontend-react/src/styles/tokens.css 中
 * --chart-color-1 ~ --chart-color-8 保持一致）
 *
 * ⚠️ 重要约束：ECharts 在 canvas/SVG 渲染时不会解析 CSS var()，
 *    必须用真实 hex 值。JSX 内的 style={{ color: 'var(--chart-color-1)' }}
 *    可以工作（浏览器原生解析），但 ECharts series / itemStyle.color 传
 *    'var(--chart-color-1)' 会被当作非法颜色静默 fallback 到默认色（灰色）。
 *
 * 使用方式:
 *   import { ECHARTS_COLORS, pickEChartsColor } from '@/utils/echartsColors';
 *   itemStyle: { color: pickEChartsColor(idx) }
 */
export const ECHARTS_COLORS = [
  '#1890ff', // chart-color-1 蓝（品牌色）
  '#52c41a', // chart-color-2 绿
  '#faad14', // chart-color-3 黄
  '#f5222d', // chart-color-4 红
  '#722ed1', // chart-color-5 紫
  '#13c2c2', // chart-color-6 青
  '#fa8c16', // chart-color-7 橙
  '#eb2f96', // chart-color-8 粉
] as const;

export type EChartsColor = (typeof ECHARTS_COLORS)[number];

/**
 * 按索引取色（超出范围循环取，负数也安全）
 */
export const pickEChartsColor = (index: number): string => {
  const len = ECHARTS_COLORS.length;
  return ECHARTS_COLORS[((index % len) + len) % len];
};
