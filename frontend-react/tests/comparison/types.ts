/**
 * 对比测试类型定义
 */

export interface TestResult {
  testName: string;
  status: 'passed' | 'failed' | 'skipped';
  duration?: number;
  error?: string;
}

export interface ComparisonResult {
  page: string;
  testName: string;
  oldFrontend: boolean;
  newFrontend: boolean;
  status: 'passed' | 'failed' | 'skipped';
  message?: string;
}

export interface PageComparisonSummary {
  page: string;
  oldFrontend: {
    hasPage: boolean;
    hasFilter: boolean;
    hasTable: boolean;
    hasChart: boolean;
    elementCount: number;
  };
  newFrontend: {
    hasPage: boolean;
    hasFilter: boolean;
    hasTable: boolean;
    hasChart: boolean;
    elementCount: number;
  };
  consistency: number; // 0-1 一致性分数
  issues: string[];
}

export interface ComparisonConfig {
  oldFrontendUrl: string;
  newFrontendUrl: string;
  timeout: number;
  retries: number;
}

export const DEFAULT_CONFIG: ComparisonConfig = {
  oldFrontendUrl: 'http://127.0.0.1:5000',
  newFrontendUrl: 'http://127.0.0.1:3000',
  timeout: 30000,
  retries: 2
};