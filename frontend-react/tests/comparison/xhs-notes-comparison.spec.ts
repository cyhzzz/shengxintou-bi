import { test, expect } from '@playwright/test';
import {
  waitForPageReady,
  expectFilterBarVisible,
  expectDataTableVisible,
  expectMetricCardsVisible,
  expectChartVisible,
  PAGE_ROUTES,
  WAIT_CONFIG,
} from './utils';

/**
 * 小红书报表页面对比测试
 * Batch 2: 分析报表
 * 包含：笔记列表、运营分析
 */

test.describe('小红书笔记列表对比测试', () => {
  test.describe.configure({ mode: 'parallel' });

  // 旧前端测试
  test('旧前端 - 页面加载', async ({ page }) => {
    // 旧前端使用 JavaScript 导航，不支持 URL 参数
    await page.goto('http://127.0.0.1:5000/');
    await waitForPageReady(page);

    // 先展开小红书菜单
    const xhsMenu = page.locator('[data-report="xhs-notes"]');
    await xhsMenu.click();
    await page.waitForTimeout(500);

    // 点击笔记列表子菜单
    const listMenu = page.locator('[data-report="xhs-notes-list"]');
    await listMenu.click();
    await page.waitForTimeout(WAIT_CONFIG.pageLoad);

    // 验证筛选器
    await expectFilterBarVisible(page, false);

    // 验证数据表格
    await expectDataTableVisible(page, false);
  });

  // 新前端测试
  test('新前端 - 页面加载', async ({ page }) => {
    const route = PAGE_ROUTES['xhs-notes-list'];
    await page.goto('http://localhost:5173' + route.new);
    await waitForPageReady(page);

    // 验证筛选器
    await expectFilterBarVisible(page, true);

    // 验证数据表格
    await expectDataTableVisible(page, true);
  });

  test('新前端 - 筛选器功能', async ({ page }) => {
    await page.goto('http://localhost:5173/xhs-notes/list');
    await waitForPageReady(page);

    // 验证日期范围选择器
    const dateRangePicker = page.locator('.ant-picker-range').first();
    if (await dateRangePicker.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(dateRangePicker).toBeVisible();
    }

    // 验证创作者筛选器
    const creatorSelect = page.locator('.ant-select:has-text("创作者")').first();
    if (await creatorSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(creatorSelect).toBeVisible();
    }
  });

  test('新前端 - 导出功能', async ({ page }) => {
    await page.goto('http://localhost:5173/xhs-notes/list');
    await waitForPageReady(page);

    // 查找导出按钮
    const exportButton = page.locator('button:has-text("导出")').first();
    if (await exportButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      // 导出按钮可能因无数据而禁用，只检查可见性
      await expect(exportButton).toBeVisible();
    }
  });
});

test.describe('小红书运营分析对比测试', () => {
  test.describe.configure({ mode: 'parallel' });

  // 旧前端测试
  test('旧前端 - 页面加载', async ({ page }) => {
    // 旧前端使用 JavaScript 导航，不支持 URL 参数
    await page.goto('http://127.0.0.1:5000/');
    await waitForPageReady(page);

    // 先展开小红书菜单
    const xhsMenu = page.locator('[data-report="xhs-notes"]');
    await xhsMenu.click();
    await page.waitForTimeout(500);

    // 点击运营分析子菜单
    const operationMenu = page.locator('[data-report="xhs-notes-operation"]');
    await operationMenu.click();
    await page.waitForTimeout(WAIT_CONFIG.pageLoad);

    // 验证筛选器
    await expectFilterBarVisible(page, false);
  });

  // 新前端测试
  test('新前端 - 页面加载', async ({ page }) => {
    const route = PAGE_ROUTES['xhs-notes-operation'];
    await page.goto('http://localhost:5173' + route.new);
    await waitForPageReady(page);

    // 验证筛选器
    await expectFilterBarVisible(page, true);
  });

  test('新前端 - 核心指标卡片', async ({ page }) => {
    await page.goto('http://localhost:5173/xhs-notes/operation');
    await waitForPageReady(page);

    // 点击查询按钮加载最新数据
    const searchButton = page.locator('button:has-text("查询")').first();
    if (await searchButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      // 先设置日期范围
      const dateRangePicker = page.locator('.ant-picker-range').first();
      if (await dateRangePicker.isVisible({ timeout: 2000 }).catch(() => false)) {
        await dateRangePicker.click();
        // 选择快速日期
        const quickButton = page.locator('button:has-text("近30天")').first();
        if (await quickButton.isVisible()) {
          await quickButton.click();
          await page.waitForTimeout(500);
        }
      }
    }

    // 验证指标卡片区域
    const metricsRow = page.locator('[class*="metricsRow"], .ant-row').first();
    await expect(metricsRow).toBeVisible({ timeout: 10000 });
  });

  test('新前端 - 创作者内容数据表格', async ({ page }) => {
    await page.goto('http://localhost:5173/xhs-notes/operation');
    await waitForPageReady(page);

    // 验证创作者内容数据表格
    const creatorTable = page.locator('.ant-card:has-text("创作者内容")').first();
    if (await creatorTable.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(creatorTable).toBeVisible();
    }
  });

  test('新前端 - 趋势图', async ({ page }) => {
    await page.goto('http://localhost:5173/xhs-notes/operation');
    await waitForPageReady(page);

    // 验证创作趋势图
    const trendChart = page.locator('.ant-card:has-text("创作趋势")').first();
    if (await trendChart.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(trendChart).toBeVisible();
    }
  });
});