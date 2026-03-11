// API 通用响应类型
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

// 分页响应
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

// 元数据
export interface Metadata {
  platforms: string[];
  agencies: string[];
  business_models: string[];
  date_range: {
    min: string;
    max: string;
  };
}