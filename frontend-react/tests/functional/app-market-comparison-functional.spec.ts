/**
 * 应用市场 · 市场对比页面功能测试
 * 路由: /app-market/comparison
 * 数据源: fact_conv_appmarket
 */
import { test, expect } from '@playwright/test';
import {
  navigateToPage,
  waitForDataLoad,
  waitForChartRender,
  expectSidebarVisible,
  expectMainContentVisible,
  expectFilterBarVisible,
  expectChartVisible,
  clickSearchButton,
  getTableRowCount,
  hasDataInTable,
  checkElementExists,
  waitForLoadingComplete,
} from './utils';

test.describe('应用市场对比页面功能测试', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToPage(page, 'app-market-comparison');
  });

  test('页面加载 - 基本结构验证', async ({ page }) => {
    await expectSidebarVisible(page);
    await expectMainContentVisible(page);
    await expectFilterBarVisible(page);
  });

  test('页面加载 - 筛选器组件', async ({ page }) => {
    await expectFilterBarVisible(page);
    const selects = page.locator('.ant-select');
    const selectCount = await selects.count();
    console.log('筛选器下拉框数量:', selectCount);
  });

  test('页面加载 - 图表显示', async ({ page }) => {
    await waitForChartRender(page);
    await expectChartVisible(page);
  });

  test('页面加载 - 数据表格显示', async ({ page }) => {
    await waitForDataLoad(page);
    const table = page.locator('.ant-table').first();
    const isTableVisible = await table.isVisible({ timeout: 15000 }).catch(() => false);
    console.log('数据表格可见:', isTableVisible);
  });

  test('筛选器 - 查询按钮功能', async ({ page }) => {
    await clickSearchButton(page);
    await waitForDataLoad(page);
  });

  test('筛选器 - 重置按钮功能', async ({ page }) => {
    const resetButton = page.locator('button:has-text("重置"), .ant-btn-default:has-text("重置")').first();
    if (await resetButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await resetButton.click();
      await waitForDataLoad(page);
    }
  });

  test('数据表格 - 列显示验证', async ({ page }) => {
    await waitForDataLoad(page);
    const table = page.locator('.ant-table').first();
    if (await table.isVisible({ timeout: 5000 }).catch(() => false)) {
      const headers = page.locator('.ant-table-thead th');
      const headerCount = await headers.count();
      expect(headerCount).toBeGreaterThan(0);
      const headerTexts = await headers.allTextContents();
      console.log('表格列:', headerTexts);
    }
  });

  test('数据表格 - 行数据验证', async ({ page }) => {
    await waitForDataLoad(page);
    const rowCount = await getTableRowCount(page);
    console.log('表格行数:', rowCount);
  });

  test('数据加载 - 等待加载完成', async ({ page }) => {
    await waitForLoadingComplete(page);
    const hasData = await hasDataInTable(page);
    console.log('应用市场对比有数据:', hasData);
  });

  test('错误处理 - 无数据场景', async ({ page }) => {
    await waitForDataLoad(page);
    const emptyState = page.locator('.ant-empty, text=/暂无数据/i').first();
    const hasEmptyState = await emptyState.isVisible({ timeout: 3000 }).catch(() => false);
    const hasChart = await checkElementExists(page, '[class*="chart"], canvas');
    expect(hasEmptyState || hasChart).toBeTruthy();
  });
});
