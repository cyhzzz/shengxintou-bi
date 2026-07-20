/**
 * /**
 *  * API 类型定义 - 自动生成
 *  * 生成时间: 2026-03-17T02:47:31.528Z
 *  * 请勿手动修改此文件
 *  *\/
 */
import type {
  AccountMappingCreate,
  AccountMappingListResponse,
  AccountMappingUpdate,
  AgencyAnalysisResponse,
  ConversionFunnelResponse,
  CoreMetricsResponse,
  DashboardAccountsResponse,
  DashboardTrendDataResponse,
  EmployeeConversionAnalysisResponse,
  EmployeeConversionFilterOptionsResponse,
  EmployeeConversionWeeklyResponse,
  GetAgencyAnalysisParams,
  GetConversionFunnelParams,
  GetLeadsDetailParams,
  GetTrendDailyParams,
  GetXhsNotesListParams,
  LeadsDetailResponse,
  MetadataResponse,
  PostDashboardAccountsBody,
  PostDashboardCoreMetricsBody,
  PostDashboardTrendDataBody,
  PostUploadBody,
  SuccessResponse,
  TrendResponse,
  UploadResponse,
  XhsNotesListResponse,
  XhsOperationAnalysisData
} from './api.schemas';

import { customMutator } from '../services/orvalMutator';



  /**
 * 获取数据概览报表的账号列表，支持按平台和代理商筛选
 * @summary 获取账号列表
 */
export const postDashboardAccounts = (
    postDashboardAccountsBody: PostDashboardAccountsBody,
 ) => {
      return customMutator<DashboardAccountsResponse>(
      {url: `/dashboard/accounts`, method: 'POST',
      headers: {'Content-Type': 'application/json', },
      data: postDashboardAccountsBody
    },
      );
    }
  
/**
 * 获取数据概览核心指标，包含投入、曝光、点击、线索、开户、资产等数据

指标分类：
- 投入效果：总花费(investment)、总曝光(total_impressions)、总点击(total_clicks)
- 业务成果：总线索(total_leads)、新开客户(new_customers)、新有效户(new_valid_accounts)
- 客户资产：新客户资产(customer_assets)、客户贡献(customer_contribution)、存量客户资产(existing_customers_assets)
- 效率指标：线索成本(cost_per_lead)、有效户成本(cost_per_valid_account)

 * @summary 获取核心指标
 */
export const postDashboardCoreMetrics = (
    postDashboardCoreMetricsBody: PostDashboardCoreMetricsBody,
 ) => {
      return customMutator<CoreMetricsResponse>(
      {url: `/dashboard/core-metrics`, method: 'POST',
      headers: {'Content-Type': 'application/json', },
      data: postDashboardCoreMetricsBody
    },
      );
    }
  
/**
 * 获取指定指标的趋势数据，用于绘制趋势图

支持的指标类型：
- cost_per_lead: 线索成本趋势
- cost_per_customer: 开户成本趋势
- cost_per_valid_account: 有效户成本趋势

 * @summary 获取趋势数据
 */
export const postDashboardTrendData = (
    postDashboardTrendDataBody: PostDashboardTrendDataBody,
 ) => {
      return customMutator<DashboardTrendDataResponse>(
      {url: `/dashboard/trend-data`, method: 'POST',
      headers: {'Content-Type': 'application/json', },
      data: postDashboardTrendDataBody
    },
      );
    }
  
/**
 * 获取指定日期范围内的日级趋势数据
 * @summary 获取日级趋势数据
 */
export const getTrendDaily = (
    params: GetTrendDailyParams,
 ) => {
      return customMutator<TrendResponse>(
      {url: `/trend/daily`, method: 'GET',
        params
    },
      );
    }
  
/**
 * 获取代理商维度的投放和转化数据分析
 * @summary 获取厂商分析数据
 */
export const getAgencyAnalysis = (
    params?: GetAgencyAnalysisParams,
 ) => {
      return customMutator<AgencyAnalysisResponse>(
      {url: `/agency-analysis`, method: 'GET',
        params
    },
      );
    }
  
/**
 * 获取从曝光到开户的完整转化漏斗
 * @summary 获取转化漏斗数据
 */
export const getConversionFunnel = (
    params: GetConversionFunnelParams,
 ) => {
      return customMutator<ConversionFunnelResponse>(
      {url: `/conversion-funnel`, method: 'GET',
        params
    },
      );
    }
  
/**
 * 获取分页的客户线索到转化的数据明细
 * @summary 获取线索明细列表
 */
export const getLeadsDetail = (
    params?: GetLeadsDetailParams,
 ) => {
      return customMutator<LeadsDetailResponse>(
      {url: `/leads-detail`, method: 'GET',
        params
    },
      );
    }
  
/**
 * @summary 获取笔记列表
 */
export const getXhsNotesList = (
    params?: GetXhsNotesListParams,
 ) => {
      return customMutator<XhsNotesListResponse>(
      {url: `/xhs-notes/list`, method: 'GET',
        params
    },
      );
    }
  
/**
 * @summary 获取账号映射列表
 */
export const getAccountMapping = (
    
 ) => {
      return customMutator<AccountMappingListResponse>(
      {url: `/account-mapping`, method: 'GET'
    },
      );
    }
  
/**
 * @summary 创建账号映射
 */
export const postAccountMapping = (
    accountMappingCreate: AccountMappingCreate,
 ) => {
      return customMutator<SuccessResponse>(
      {url: `/account-mapping`, method: 'POST',
      headers: {'Content-Type': 'application/json', },
      data: accountMappingCreate
    },
      );
    }
  
/**
 * @summary 更新账号映射
 */
export const putAccountMappingPlatformAccountId = (
    platform: string,
    accountId: string,
    accountMappingUpdate: AccountMappingUpdate,
 ) => {
      return customMutator<SuccessResponse>(
      {url: `/account-mapping/${platform}/${accountId}`, method: 'PUT',
      headers: {'Content-Type': 'application/json', },
      data: accountMappingUpdate
    },
      );
    }
  
/**
 * @summary 删除账号映射
 */
export const deleteAccountMappingPlatformAccountId = (
    platform: string,
    accountId: string,
 ) => {
      return customMutator<SuccessResponse>(
      {url: `/account-mapping/${platform}/${accountId}`, method: 'DELETE'
    },
      );
    }
  
/**
 * 上传 Excel/CSV 文件导入各类数据
 * @summary 上传文件
 */
export const postUpload = (
    postUploadBody: PostUploadBody,
 ) => {const formData = new FormData();
formData.append(`file`, postUploadBody.file)
formData.append(`data_type`, postUploadBody.data_type)
if(postUploadBody.overwrite !== undefined) {
 formData.append(`overwrite`, postUploadBody.overwrite.toString())
 }

      return customMutator<UploadResponse>(
      {url: `/upload`, method: 'POST',
      headers: {'Content-Type': 'multipart/form-data', },
       data: formData
    },
      );
    }
  
/**
 * 获取平台、代理商、业务模式等元数据列表
 * @summary 获取元数据
 */
export const getMetadata = (
    
 ) => {
      return customMutator<MetadataResponse>(
      {url: `/metadata`, method: 'GET'
    },
      );
    }
  
export type PostDashboardAccountsResult = NonNullable<Awaited<ReturnType<typeof postDashboardAccounts>>>
export type PostDashboardCoreMetricsResult = NonNullable<Awaited<ReturnType<typeof postDashboardCoreMetrics>>>
export type PostDashboardTrendDataResult = NonNullable<Awaited<ReturnType<typeof postDashboardTrendData>>>
export type GetTrendDailyResult = NonNullable<Awaited<ReturnType<typeof getTrendDaily>>>
export type GetAgencyAnalysisResult = NonNullable<Awaited<ReturnType<typeof getAgencyAnalysis>>>
export type GetConversionFunnelResult = NonNullable<Awaited<ReturnType<typeof getConversionFunnel>>>
export type GetLeadsDetailResult = NonNullable<Awaited<ReturnType<typeof getLeadsDetail>>>
export type GetXhsNotesListResult = NonNullable<Awaited<ReturnType<typeof getXhsNotesList>>>
export type GetAccountMappingResult = NonNullable<Awaited<ReturnType<typeof getAccountMapping>>>
export type PostAccountMappingResult = NonNullable<Awaited<ReturnType<typeof postAccountMapping>>>
export type PutAccountMappingPlatformAccountIdResult = NonNullable<Awaited<ReturnType<typeof putAccountMappingPlatformAccountId>>>
export type DeleteAccountMappingPlatformAccountIdResult = NonNullable<Awaited<ReturnType<typeof deleteAccountMappingPlatformAccountId>>>
export type PostUploadResult = NonNullable<Awaited<ReturnType<typeof postUpload>>>
export type GetMetadataResult = NonNullable<Awaited<ReturnType<typeof getMetadata>>>

// ============================================
// Employee Conversion - 员工转化分析
// ============================================

/**
 * 获取员工转化分析数据
 * @summary 员工转化分析
 */
export const postEmployeeConversionAnalysis = (
  params: Record<string, unknown>,
) => {
  return customMutator<EmployeeConversionAnalysisResponse>(
    {url: `/employee-conversion/analysis`, method: 'POST',
    headers: {'Content-Type': 'application/json', },
    data: params
  },
  );
}

/**
 * 获取员工转化周报数据
 * @summary 员工转化周报
 */
export const postEmployeeConversionWeekly = (
  params: Record<string, unknown>,
) => {
  return customMutator<EmployeeConversionWeeklyResponse>(
    {url: `/employee-conversion/weekly`, method: 'POST',
    headers: {'Content-Type': 'application/json', },
    data: params
  },
  );
}

/**
 * 获取员工列表
 * @summary 员工列表
 */
export const getEmployeeConversionEmployees = () => {
  return customMutator<{ success: boolean; data?: string[] }>(
    {url: `/employee-conversion/employees`, method: 'GET'
  },
  );
}

/**
 * 获取筛选选项
 * @summary 筛选选项
 */
export const getEmployeeConversionFilterOptions = () => {
  return customMutator<EmployeeConversionFilterOptionsResponse>(
    {url: `/employee-conversion/filter-options`, method: 'GET'
  },
  );
}

export type PostEmployeeConversionAnalysisResult = NonNullable<Awaited<ReturnType<typeof postEmployeeConversionAnalysis>>>
export type PostEmployeeConversionWeeklyResult = NonNullable<Awaited<ReturnType<typeof postEmployeeConversionWeekly>>>
export type GetEmployeeConversionEmployeesResult = NonNullable<Awaited<ReturnType<typeof getEmployeeConversionEmployees>>>
export type GetEmployeeConversionFilterOptionsResult = NonNullable<Awaited<ReturnType<typeof getEmployeeConversionFilterOptions>>>

// ============================================
// XHS Notes Operation Analysis - 小红书运营分析
// ============================================

/**
 * 获取小红书运营分析数据
 * @summary 小红书运营分析
 */
export const postXhsOperationAnalysis = (
  params: {
    filters?: {
      date_range?: [string, string];
      top_notes_date_range?: [string, string];
      creator_annual_date_range?: [string, string];
    };
  },
) => {
  return customMutator<{
    success: boolean;
    data?: XhsOperationAnalysisData;
  }>(
    {url: `/xhs-notes-operation-analysis`, method: 'POST',
    headers: {'Content-Type': 'application/json', },
    data: params
  },
  );
}

export type PostXhsOperationAnalysisResult = NonNullable<Awaited<ReturnType<typeof postXhsOperationAnalysis>>>
