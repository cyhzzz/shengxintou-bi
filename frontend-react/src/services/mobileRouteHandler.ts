/**
 * 移动端本地路由处理器（分发器）
 *
 * 将前端 API 请求映射到本地 SQLite 查询，在离线模式下替代 Flask 后端。
 * v3.8.x 起按报表域拆分：各 handler 实现位于 ./mobileHandlers/ 目录，
 * 本文件仅保留 URL 解析与 case 分发。SQL 口径与 Flask 后端一致。
 *
 * 业务不变式（与后端一致）：
 * - 应用市场漏斗：强制 渠道类型 = '互联网引流'
 * - 内容平台存量剔除：是否为存量客户 = 0 OR IS NULL
 */
import { handleOmniChannelSummary, handleOmniChannelFilterOptions, handleOmniChannelDailyCalendar, handleOmniChannelDailyTrend, handleOmniChannelByChannel } from './mobileHandlers/omniChannel';
import { handleAppMarketFunnel, handleAppMarketFilterOptions, handleAppMarketSummary, handleAppMarketDetail, handleAppMarketCostAnalysis, handleAppMarketAttributionConversion, handleAppMarketPlanAnalysis, handleAppMarketCreative, handleAppMarketAdPlanAnalysis } from './mobileHandlers/appMarket';
import { handleDashboardCoreMetrics, handleDashboardTrendData } from './mobileHandlers/dashboard';
import { handleCostAnalysis } from './mobileHandlers/costAnalysis';
import { handleAgencyAnalysis } from './mobileHandlers/agencyAnalysis';
import { handleConversionFunnelSplit } from './mobileHandlers/conversionFunnel';
import { handleLeadsDetail, handleLeadsDetailFilterOptions, handleAnchorClusters, handleAnchorClustersTrend, handleAnchorWeeklyAnalysis, handleInvestmentReview } from './mobileHandlers/leads';
import { handleXhsNotesList, handleXhsNotesFilterOptions, handleXhsNotesOperationAnalysis, handleXhsPlanAnalysis } from './mobileHandlers/xhs';
import { handleEmployeeConversionAnalysis, handleEmployeeConversionWeekly, handleEmployeeConversionAnalysisChannelOverview, handleEmployeeConversionFilterOptions } from './mobileHandlers/employee';
import { handleKosWeekly, handleKosWeeklyFilterOptions } from './mobileHandlers/kos';
import { handleDataFreshness } from './mobileHandlers/freshness';
import { handleWeeklyPeriods, handleWeeklyData } from './mobileHandlers/weekly';
import { handleMetadata } from './mobileHandlers/metadata';

// v3.6.4：由 vite.config.ts define 注入的 version.json 内容（构建时确定）
// 移动端/PWA 端关于页的 version/local 端点直接返回此对象
declare const __APP_VERSION_INFO__: {
  version: string;
  release_date: string;
  changelog?: string[];
  [key: string]: unknown;
};
const APP_VERSION_INFO = __APP_VERSION_INFO__;

/** 从完整 URL 提取 /api/v1/ 之后的路径 */
function extractApiPath(url: string): string {
  const match = url.match(/\/api\/v1\/(.+?)(?:\?|$)/);
  return match ? match[1] : '';
}

/**
 * 移动端路由处理器入口
 *
 * 将前端 API 请求 URL + body 映射到本地 SQLite 查询，返回与 Flask 后端一致的 data 结构。
 */
export async function mobileRouteHandler(url: string, body: any): Promise<any> {
  const path = extractApiPath(url);

  switch (path) {
    // 元数据（全局筛选项数据源，供 FilterBar 使用）
    case 'metadata':
      return handleMetadata();

    // 全渠道获客
    case 'reports/omni-channel/summary':
      return handleOmniChannelSummary(body);
    case 'reports/omni-channel/filter-options':
      return handleOmniChannelFilterOptions();
    case 'reports/omni-channel/daily-calendar':
      return handleOmniChannelDailyCalendar(body);
    case 'reports/omni-channel/daily-trend':
      return handleOmniChannelDailyTrend(body);
    case 'reports/omni-channel/by-channel':
      return handleOmniChannelByChannel(body);

    // 应用市场
    case 'reports/app-market/funnel':
      return handleAppMarketFunnel(body);
    case 'reports/app-market/summary':
      return handleAppMarketSummary(body);
    case 'reports/app-market/detail':
      return handleAppMarketDetail(body);
    case 'reports/app-market/filter-options':
      return handleAppMarketFilterOptions();

    // 仪表盘
    case 'dashboard/core-metrics':
      return handleDashboardCoreMetrics(body);
    case 'dashboard/trend-data':
      return handleDashboardTrendData(body);

    // 内容平台成本分析
    case 'cost-analysis':
      return handleCostAnalysis(body);

    // 代理商分析
    case 'agency-analysis':
      return handleAgencyAnalysis(url, body);

    // 转化漏斗拆分
    case 'conversion-funnel/split':
      return handleConversionFunnelSplit(url, body);

    // 线索明细
    case 'leads-detail':
      return handleLeadsDetail(url);
    case 'leads-detail/filter-options':
      return handleLeadsDetailFilterOptions();

    // 主播聚类 / 主播周分析
    case 'leads-detail/anchor-clusters':
      return handleAnchorClusters(body);
    case 'leads-detail/anchor-clusters-trend':
      return handleAnchorClustersTrend(body);
    case 'leads-detail/anchor-weekly-analysis':
      return handleAnchorWeeklyAnalysis(body);

    // 投放评审
    case 'investment-review':
      return handleInvestmentReview(url, body);

    // 应用市场子报表
    case 'reports/app-market/plan-analysis':
      return handleAppMarketPlanAnalysis(body);
    case 'reports/app-market/creative':
      return handleAppMarketCreative(body);
    case 'reports/app-market/cost-analysis':
      return handleAppMarketCostAnalysis(body);
    // 广告计划分析（计划周粒度漏斗，结合 dim_ad_plan_class + fact_conv_appmarket + agg_vendor_daily）
    case 'reports/app-market/ad-plan-analysis':
      return handleAppMarketAdPlanAnalysis(body);
    case 'reports/app-market/attribution-conversion':
      return handleAppMarketAttributionConversion(body);

    // 小红书
    case 'xhs-notes-list':
    case 'xhs-notes/list':
      return handleXhsNotesList(url, body);
    case 'xhs-notes/filter-options':
      return handleXhsNotesFilterOptions();
    case 'xhs-notes-operation-analysis':
      return handleXhsNotesOperationAnalysis(body);
    case 'reports/xhs/plan-analysis':
      return handleXhsPlanAnalysis(body);
    case 'xhs/kos-weekly':
      return handleKosWeekly(body);
    case 'xhs/kos-weekly/filter-options':
      return handleKosWeeklyFilterOptions();

    // 员工转化
    case 'employee-conversion/analysis':
      return handleEmployeeConversionAnalysis(body);
    case 'employee-conversion/weekly':
      return handleEmployeeConversionWeekly(body);
    case 'employee-conversion/analysis-channel-overview':
      return handleEmployeeConversionAnalysisChannelOverview(body);
    case 'employee-conversion/filter-options':
      return handleEmployeeConversionFilterOptions();

    // v3.5.5：周报（报告生成页面）
    case 'reports/weekly/periods':
      return handleWeeklyPeriods();
    case 'reports/weekly/data':
      return handleWeeklyData(body);

    // v3.6.4：版本信息（关于页），由 vite define 在构建时注入，无需数据库查询
    case 'version/local':
      return APP_VERSION_INFO;

    // v3.7.3：数据新鲜度（关于页数据状态），与后端 metadata.get_data_status 对齐
    case 'data-freshness':
      return handleDataFreshness();

    default:
      throw new Error(`Mobile API not implemented: ${path}`);
  }
}
