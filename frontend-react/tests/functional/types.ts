/**
 * 新前端功能测试 - 类型定义
 */

export interface FunctionalTestResult {
  testName: string;
  page: string;
  status: 'passed' | 'failed' | 'skipped';
  duration?: number;
  error?: string;
  details?: Record<string, any>;
}

export interface PageElementCheck {
  name: string;
  selector: string;
  visible: boolean;
  timeout?: number;
}

export interface FilterInteraction {
  name: string;
  selector: string;
  action: 'click' | 'select' | 'input';
  value?: string;
}

export interface FunctionalConfig {
  baseURL: string;
  timeout: number;
  waitConfig: {
    pageLoad: number;
    dataLoad: number;
    chartRender: number;
    filterChange: number;
    animation: number;
  };
}

export const DEFAULT_FUNCTIONAL_CONFIG: FunctionalConfig = {
  baseURL: 'http://localhost:3000',
  timeout: 60000,
  waitConfig: {
    pageLoad: 3000,
    dataLoad: 2000,
    chartRender: 2500,
    filterChange: 1500,
    animation: 500,
  },
};
