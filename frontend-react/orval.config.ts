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