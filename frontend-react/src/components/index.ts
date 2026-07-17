/**
 * 组件导出
 * 集中导出所有可复用组件
 */

// 图标组件
export * from './Icon';

// 帮助模态框
export { HelpModal } from './HelpModal';

// 页面路由过渡
export { default as AnimatedOutlet } from './AnimatedOutlet';

// 数据新鲜度指示器
export { DataFreshnessIndicator } from './DataFreshness';
export type { DataFreshnessIndicatorRef } from './DataFreshness';

// 指南弹窗
export { default as GuideModal } from './GuideModal';

// 筛选器组件
export * from './Filter';

// 图表组件
export * from './Chart';
// 统一指标卡片
export * from './MetricCard';

// 报表底部弱化区（数据源 / 口径 / 备注统一脚注）
export * from './ReportFooter';
