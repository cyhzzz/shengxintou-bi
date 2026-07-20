/**
 * 上传 API 服务
 * 提供文件上传相关接口
 */
import { http } from './http';
import type { ApiResponse } from '@/types';

// 数据类型
export type DataType =
  | 'tencent_ads'
  | 'douyin_ads'
  | 'xiaohongshu_ads'
  | 'xhs_notes_content_daily'
  | 'xhs_notes_daily'
  | 'xhs_notes_list'
  | 'backend_conversion';

// 上传结果
export interface UploadResult {
  total_rows: number;
  success_count: number;
  failed_count: number;
  failed_rows: number[];
  errors: string[];
  import_log_id?: number;
}

// 版本信息
export interface VersionInfo {
  version: string;
  release_date: string;
  changelog: string[];
  portable?: boolean;
}

// 上传服务
export const uploadService = {
  // 上传文件
  // v3.3.6：qingniao_leads 支持 batchTag（批次标注），不传时后端用 'YYYYMMDDHHmm'
  uploadFile: async (
    file: File,
    dataType: DataType,
    overwrite: boolean = false,
    batchTag?: string
  ): Promise<ApiResponse<UploadResult>> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('data_type', dataType);
    formData.append('overwrite', String(overwrite));
    if (batchTag && batchTag.trim()) {
      formData.append('batch_tag', batchTag.trim());
    }

    return http.upload('/upload', formData);
  },

  // 获取导入日志
  getImportLogs: async (): Promise<ApiResponse<unknown[]>> => {
    return http.get('/import-logs');
  },

  // 获取版本信息
  getVersion: async (): Promise<ApiResponse<VersionInfo>> => {
    return http.get('/version');
  },
};