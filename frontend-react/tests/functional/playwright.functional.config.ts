import { defineConfig, devices } from '@playwright/test';

/**
 * 新前端功能测试配置
 *
 * 使用方法:
 * 1. 启动后端服务: cd 开发代码 && set DEV_MODE=1 && python-3.9-embed\python.exe app.py
 * 2. 启动新前端: cd 开发代码/frontend-react && npm run dev
 * 3. 运行功能测试: npx playwright test tests/functional --config=tests/functional/playwright.functional.config.ts
 */

export default defineConfig({
  testDir: './',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { open: 'never', outputFolder: 'test-results/functional-html' }],
    ['list'],
    ['json', { outputFile: 'test-results/functional-results.json' }]
  ],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    baseURL: 'http://localhost:3000',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120000,
  },
  projects: [
    {
      name: 'functional-tests',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
  timeout: 60000,
  expect: {
    timeout: 15000,
  },
});
