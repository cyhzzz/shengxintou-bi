# API 类型自动生成

## 概述

使用 [orval](https://orval.dev/) 从 OpenAPI/Swagger 规范自动生成 TypeScript 类型定义和 API 客户端。

## 为什么使用 orval

1. **类型安全**: 自动生成精确的 TypeScript 类型
2. **减少手动维护**: API 变更时自动更新类型
3. **开发效率**: 无需手写 API 调用代码
4. **文档同步**: 类型定义与后端 API 文档保持一致

## 安装依赖

```bash
npm install -D orval openapi-typescript
```

## 配置文件

项目根目录的 `orval.config.ts`:

```typescript
import { defineConfig } from 'orval';

export default defineConfig({
  api: {
    input: {
      // 使用本地 OpenAPI 规范文件
      // 当后端服务器重启后，可以从 http://localhost:5000/apispec_1.json 获取最新版本
      target: './openapi.yaml',
    },
    output: {
      target: './src/types/api.ts',
      // 不生成客户端代码，只生成类型
      mode: 'split',
      clean: true,
      override: {
        mutator: {
          path: './src/services/orvalMutator.ts',
          name: 'customMutator',
        },
        header: () => [
          '/**',
          ' * API 类型定义 - 自动生成',
          ' * 生成时间: ' + new Date().toISOString(),
          ' * 请勿手动修改此文件',
          ' */',
        ],
      },
    },
  },
});
```

## HTTP 客户端适配器

`src/services/orvalMutator.ts` 适配现有 HTTP 客户端:

```typescript
import { http } from './http';
import type { ApiResponse } from '@/types';

export interface OrvalRequestConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  params?: Record<string, unknown>;
  data?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export const customMutator = async <T>(config: OrvalRequestConfig): Promise<ApiResponse<T>> => {
  const { url, method, params, data, headers } = config;

  const requestConfig = headers ? { headers } : undefined;

  switch (method) {
    case 'GET':
      return http.get<T>(url, params, requestConfig);
    case 'POST':
      return http.post<T>(url, data, requestConfig);
    case 'PUT':
      return http.put<T>(url, data, requestConfig);
    case 'DELETE':
      return http.delete<T>(url, requestConfig);
    case 'PATCH':
      return http.request<T>(url, {
        method: 'PATCH',
        body: data ? JSON.stringify(data) : undefined,
        ...(headers ? { headers } : {}),
      });
    default:
      throw new Error(`Unsupported HTTP method: ${method}`);
  }
};
```

## 使用方法

### 生成类型

```bash
npm run generate:api
```

### 监听模式（开发时自动重新生成）

```bash
npm run generate:api:watch
```

### 使用生成的 API 函数

```typescript
import { getDashboardCoreMetrics } from '@/types/api';

// 在组件中使用
const fetchMetrics = async () => {
  const response = await getDashboardCoreMetrics({
    start_date: '2025-01-01',
    end_date: '2025-01-31',
  });

  if (response.success) {
    console.log(response.data.core_metrics);
  }
};
```

### 使用生成的类型

```typescript
import type { CoreMetrics, CoreMetricsResponse } from '@/types/api.schemas';

const metrics: CoreMetrics = {
  investment: 100000,
  total_impressions: 1000000,
  total_clicks: 50000,
  total_leads: 500,
  new_customers: 50,
  new_valid_accounts: 30,
};
```

## 后端 Swagger 配置

后端使用 `flasgger` 生成 OpenAPI 规范：

- **Swagger UI**: http://localhost:5000/apidocs
- **JSON 规范**: http://localhost:5000/apispec_1.json

### 本地 OpenAPI 文件

项目包含本地 `openapi.yaml` 文件，用于：
1. 离线类型生成（不需要后端服务器运行）
2. 类型定义的版本控制
3. 前端开发的独立性

### 更新本地 OpenAPI 文件

当后端 API 变更后：

```bash
# 方法1：从运行中的服务器下载
curl http://localhost:5000/apispec_1.json -o openapi.json

# 方法2：手动编辑 openapi.yaml

# 然后重新生成类型
npm run generate:api
```

## 生成文件结构

```
src/types/
├── api.ts           # API 函数和导出
├── api.schemas.ts   # 类型定义
├── models.ts        # 业务模型类型（手写）
├── charts.ts        # 图表类型（手写）
└── index.ts         # 统一导出
```

## NPM 脚本

在 `package.json` 中:

```json
{
  "scripts": {
    "generate:api": "orval --config orval.config.ts",
    "generate:api:watch": "orval --config orval.config.ts --watch"
  }
}
```

## 最佳实践

1. **每次后端 API 变更后重新生成类型**
2. **不要手动修改生成的类型文件** (`api.ts`, `api.schemas.ts`)
3. **使用生成的类型而非手写类型**
4. **保持 `openapi.yaml` 与后端 API 同步**
5. **自定义业务模型放在 `models.ts`**

## 故障排查

### 问题: 生成的类型与实际响应不匹配

**原因**: `openapi.yaml` 文件过时或不准确

**解决**:
1. 更新 `openapi.yaml` 文件
2. 或从运行中的服务器下载最新的 OpenAPI 规范

### 问题: orval 无法连接后端

**原因**: 后端服务未启动或 Swagger 未初始化

**解决**:
1. 确保后端服务器已重启（Swagger 在启动时初始化）
2. 或使用本地 `openapi.yaml` 文件

### 问题: 生成的客户端代码格式不符合项目规范

**解决**: 在 orval 配置中使用 `override` 选项自定义输出格式

## 相关文件

- `orval.config.ts` - orval 配置
- `openapi.yaml` - 本地 OpenAPI 规范
- `src/services/orvalMutator.ts` - HTTP 客户端适配器
- `src/types/api.ts` - 生成的 API 函数
- `src/types/api.schemas.ts` - 生成的类型定义