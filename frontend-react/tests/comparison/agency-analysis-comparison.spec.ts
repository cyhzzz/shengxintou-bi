import { test, expect } from '@playwright/test';
import {
  waitForPageReady,
  expectSidebarVisible,
  expectFilterBarVisible,
  expectDataTableVisible,
  expectChartVisible,
  PAGE_ROUTES,
  WAIT_CONFIG,
} from './utils';

/**
 * 厂商分析页面对比测试
 * Batch 1: 核心页面
 */

test.describe('厂商分析页面对比测试', () => {
  test.describe.configure({ mode: 'parallel' });

  // 旧前端测试
  test('旧前端 - 页面加载', async ({ page }) => {
    // 旧前端使用 JavaScript 导航，不支持 URL 参数
    await page.goto('http://127.0.0.1:5000/');
    await waitForPageReady(page);

    // 点击侧边栏的厂商分析菜单
    const agencyMenu = page.locator('[data-report="agency-analysis"]');
    await agencyMenu.click();

    // 等待页面切换完成
    await page.waitForTimeout(WAIT_CONFIG.pageLoad);

    // 验证筛选器
    await expectFilterBarVisible(page, false);

    // 验证汇总统计卡片
    const summaryCard = page.locator('.card, .summary-card').first();
    await expect(summaryCard).toBeVisible({ timeout: 10000 });
  });

  test('旧前端 - 趋势图和表格', async ({ page }) => {
    // 旧前端使用 JavaScript 导航，不支持 URL 参数
    await page.goto('http://127.0.0.1:5000/');
    await waitForPageReady(page);

    // 点击侧边栏的厂商分析菜单
    const agencyMenu = page.locator('[data-report="agency-analysis"]');
    await agencyMenu.click();

    // 等待页面切换完成
    await page.waitForTimeout(WAIT_CONFIG.pageLoad);

    // 验证趋势图
    await expectChartVisible(page, false);

    // 验证数据表格
    await expectDataTableVisible(page, false);
  });

  // 新前端测试
  test('新前端 - 页面加载', async ({ page }) => {
    const route = PAGE_ROUTES['agency-analysis'];
    await page.goto('http://localhost:5173' + route.new);
    await waitForPageReady(page);

    // 验证筛选器
    await expectFilterBarVisible(page, true);

    // 验证汇总统计 - 使用 Ant Design Statistic
    const statistic = page.locator('.ant-statistic').first();
    await expect(statistic).toBeVisible({ timeout: 10000 });
  });

  test('新前端 - 趋势图和表格', async ({ page }) => {
    const route = PAGE_ROUTES['agency-analysis'];
    await page.goto('http://localhost:5173' + route.new);
    await waitForPageReady(page);

    // 验证趋势图
    await expectChartVisible(page, true);

    // 验证数据表格
    await expectDataTableVisible(page, true);
  });

  // 功能对比
  test('功能对比 - 指标切换', async ({ page }) => {
    await page.goto('http://localhost:5173/agency-analysis');
    await waitForPageReady(page);

    // 查找指标切换 Segmented
    const segmented = page.locator('.ant-segmented').first();
    if (await segmented.isVisible({ timeout: 2000 }).catch(() => false)) {
      // 点击不同选项
      const options = page.locator('.ant-segmented-item');
      const count = await options.count();
      if (count > 1) {
        await options.nth(1).click();
        await page.waitForTimeout(WAIT_CONFIG.filterChange);
      }
    }
  });

  test('功能对比 - 表格排序', async ({ page }) => {
    await page.goto('http://localhost:5173/agency-analysis');
    await waitForPageReady(page);

    // 查找可排序的列头
    const sortableHeader = page.locator('.ant-table-thead th:has(.ant-table-column-sorters)').first();
    if (await sortableHeader.isVisible({ timeout: 2000 }).catch(() => false)) {
      await sortableHeader.click();
      await page.waitForTimeout(WAIT_CONFIG.filterChange);
    }
  });

  test('功能对比 - 表格汇总行', async ({ page }) => {
    await page.goto('http://localhost:5173/agency-analysis');
    await waitForPageReady(page);

    // 验证表格汇总行
    const summaryRow = page.locator('.ant-table-summary').first();
    if (await summaryRow.isVisible({ timeout: 2000 }).catch(() => false)) {
      const summaryText = await summaryRow.textContent();
      expect(summaryText).toContain('合计');
    }
  });
});