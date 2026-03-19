import { defineConfig, devices } from '@playwright/test';

/**
 * 新旧前端对比测试配置
 *
 * 使用方法:
 * 1. 启动后端服务: cd 开发代码 && set DEV_MODE=1 && python-3.9-embed\python.exe app.py
 * 2. 启动新前端: cd 开发代码/frontend-react && npm run dev
 * 3. 运行对比测试: npx playwright test tests/comparison --config=tests/comparison/playwright.comparison.config.ts
 */

export default defineConfig({
  testDir: '.',
  fullyParallel: false, // 串行执行，便于对比
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'old-frontend',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://127.0.0.1:5000',
      },
    },
    {
      name: 'new-frontend',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:3000',
      },
    },
  ],
});