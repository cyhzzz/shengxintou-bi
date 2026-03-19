import { test, expect } from '@playwright/test';
import {
  waitForPageReady,
  expectSidebarVisible,
  expectFilterBarVisible,
  expectMetricCardsVisible,
  expectChartVisible,
  PAGE_ROUTES,
  WAIT_CONFIG,
} from './utils';

/**
 * 数据概览页面对比测试
 * Batch 1: 核心页面
 */

test.describe('数据概览页面对比测试', () => {
  test.describe.configure({ mode: 'parallel' });

  // 旧前端测试
  test('旧前端 - 页面加载和基本结构', async ({ page }) => {
    // 旧前端首页即数据概览页面
    await page.goto('http://127.0.0.1:5000/');
    await waitForPageReady(page);

    // 验证页面标题
    await expect(page).toHaveTitle(/省心投/);

    // 验证侧边栏
    await expectSidebarVisible(page, false);

    // 验证筛选器
    await expectFilterBarVisible(page, false);
  });

  test('旧前端 - 指标卡片显示', async ({ page }) => {
    // 旧前端首页即数据概览页面
    await page.goto('http://127.0.0.1:5000/');
    await waitForPageReady(page);

    // 验证指标卡片
    await expectMetricCardsVisible(page, false);

    // 验证关键指标文本
    const investmentText = page.locator('text=/投入金额|阶段投入/i').first();
    await expect(investmentText).toBeVisible({ timeout: 10000 });
  });

  test('旧前端 - 趋势图显示', async ({ page }) => {
    // 旧前端首页即数据概览页面
    await page.goto('http://127.0.0.1:5000/');
    await waitForPageReady(page);

    // 验证趋势图
    await expectChartVisible(page, false);
  });

  // 新前端测试
  test('新前端 - 页面加载和基本结构', async ({ page }) => {
    const route = PAGE_ROUTES['dashboard'];
    await page.goto('http://localhost:5173' + route.new);
    await waitForPageReady(page);

    // 验证侧边栏
    await expectSidebarVisible(page, true);

    // 验证筛选器
    await expectFilterBarVisible(page, true);
  });

  test('新前端 - 指标卡片显示', async ({ page }) => {
    const route = PAGE_ROUTES['dashboard'];
    await page.goto('http://localhost:5173' + route.new);
    await waitForPageReady(page);

    // 验证指标卡片
    await expectMetricCardsVisible(page, true);

    // 验证关键指标文本 - 前端投放分组
    const frontendGroup = page.locator('text=/前端投放/i').first();
    await expect(frontendGroup).toBeVisible({ timeout: 10000 });
  });

  test('新前端 - 趋势图显示', async ({ page }) => {
    const route = PAGE_ROUTES['dashboard'];
    await page.goto('http://localhost:5173' + route.new);
    await waitForPageReady(page);

    // 验证趋势图
    await expectChartVisible(page, true);
  });

  // 功能对比测试
  test('功能对比 - 筛选器交互', async ({ page }) => {
    // 测试新前端筛选器
    await page.goto('http://localhost:5173/dashboard');
    await waitForPageReady(page);

    // 查找查询按钮
    const searchButton = page.locator('button:has-text("查询")').first();
    if (await searchButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await searchButton.click();
      await page.waitForTimeout(WAIT_CONFIG.filterChange);
    }
  });

  test('功能对比 - 趋势图指标切换', async ({ page }) => {
    await page.goto('http://localhost:5173/dashboard');
    await waitForPageReady(page);

    // 查找指标切换控件
    const metricSelect = page.locator('.ant-segmented, [class*="metric"]').first();
    if (await metricSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await metricSelect.click();
      await page.waitForTimeout(WAIT_CONFIG.filterChange);
    }
  });
});