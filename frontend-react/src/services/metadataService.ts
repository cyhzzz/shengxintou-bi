/**
 * 元数据 API 服务
 * 提供平台、代理商、业务模式等元数据接口
 */
import { http } from './http';
import type { ApiResponse } from '@/types';

// 元数据接口
export interface Metadata {
  platforms: string[];
  business_models: string[];
  agencies: string[];
  date_range: {
    min: string;
    max: string;
  };
}

// 账号映射接口
export interface AccountMapping {
  platform: string;
  account_id: string;
  account_name: string;
  main_account_id?: string;
  agency: string;
  business_model: string;
  created_at: string;
  updated_at: string;
}

// 简称映射接口
export interface AbbreviationMapping {
  id: number;
  abbreviation: string;
  full_name: string;
  mapping_type: 'agency' | 'platform';
  platform?: string;
  display_name?: string;
  description?: string;
  is_active: boolean;
}

// 数据新鲜度接口
export interface DataFreshnessItem {
  name: string;
  latest_date: string | null;
  days_ago: number | null;
  status: 'normal' | 'warning' | 'critical' | 'no_data';
  group: string;
  order: number;
}

export interface DataFreshness {
  [key: string]: DataFreshnessItem;
}

// 元数据服务
export const metadataService = {
  // 获取元数据
  getMetadata: async (): Promise<ApiResponse<Metadata>> => {
    return http.get('/metadata');
  },

  // 获取数据新鲜度
  getDataFreshness: async (): Promise<ApiResponse<DataFreshness>> => {
    return http.get('/data-freshness');
  },

  // 获取账号映射列表
  getAccountMappings: async (platform?: string): Promise<ApiResponse<AccountMapping[]>> => {
    const params = platform ? { platform } : undefined;
    return http.get('/account-agency-mapping', params);
  },

  // 创建账号映射
  createAccountMapping: async (data: Omit<AccountMapping, 'created_at' | 'updated_at'>): Promise<ApiResponse<void>> => {
    return http.post('/account-mapping', data);
  },

  // 更新账号映射
  updateAccountMapping: async (
    platform: string,
    accountId: string,
    data: Partial<AccountMapping>
  ): Promise<ApiResponse<void>> => {
    return http.put(`/account-mapping/${platform}/${accountId}`, data);
  },

  // 删除账号映射
  deleteAccountMapping: async (platform: string, accountId: string): Promise<ApiResponse<void>> => {
    return http.delete(`/account-mapping/${platform}/${accountId}`);
  },

  // 获取简称映射列表
  getAbbreviationMappings: async (): Promise<ApiResponse<AbbreviationMapping[]>> => {
    return http.get('/abbreviation-mapping');
  },

  // 创建简称映射
  createAbbreviationMapping: async (
    data: Omit<AbbreviationMapping, 'id'>
  ): Promise<ApiResponse<void>> => {
    return http.post('/abbreviation-mapping', data);
  },

  // 更新简称映射
  updateAbbreviationMapping: async (
    id: number,
    data: Partial<AbbreviationMapping>
  ): Promise<ApiResponse<void>> => {
    return http.put(`/abbreviation-mapping/${id}`, data);
  },

  // 删除简称映射
  deleteAbbreviationMapping: async (id: number): Promise<ApiResponse<void>> => {
    return http.delete(`/abbreviation-mapping/${id}`);
  },
};