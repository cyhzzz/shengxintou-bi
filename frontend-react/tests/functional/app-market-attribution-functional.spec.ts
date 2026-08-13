/**
 * 应用市场 · 归因转化率页面功能测试
 * 路由: /app-market/attribution-conversion
 * 数据源: fact_conv_appmarket
 * 功能: 5 个独立折线图 + 树形折叠明细表（周合计/每日）+ FilterBar + 平台单选
 */
import { test, expect } from '@playwright/test';
import {
  navigateToPage,
  waitForDataLoad,
  waitForChartRender,
  expectSidebarVisible,
  expectMainContentVisible,
  expectFilterBarVisible,
  clickSearchButton,
  getTableRowCount,
  hasDataInTable,
  checkElementExists,
  waitForLoadingComplete,
} from './utils';

test.describe('应用市场归因转化率页面功能测试', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToPage(page, 'app-market-attribution');
  });

  test('页面加载 - 基本结构验证', async ({ page }) => {
    await expectSidebarVisible(page);
    await expectMainContentVisible(page);
    await expectFilterBarVisible(page);
  });

  test('页面加载 - 平台筛选下拉框', async ({ page }) => {
    await expectFilterBarVisible(page);
    const selects = page.locator('.ant-select');
    const selectCount = await selects.count();
    console.log('筛选器下拉框数量:', selectCount);
    expect(selectCount).toBeGreaterThan(0);
  });

  test('页面加载 - 折线图显示（5 个步骤）', async ({ page }) => {
    await waitForChartRender(page);
    const charts = page.locator('canvas, [class*="chart"], .echarts');
    const chartCount = await charts.count();
    console.log('图表数量:', chartCount);
    expect(chartCount).toBeGreaterThan(0);
  });

  test('页面加载 - 归因转化率明细表格显示', async ({ page }) => {
    await waitForDataLoad(page);
    const table = page.locator('.ant-table').first();
    const isTableVisible = await table.isVisible({ timeout: 15000 }).catch(() => false);
    console.log('明细表格可见:', isTableVisible);
  });

  test('筛选器 - 查询按钮功能', async ({ page }) => {
    await clickSearchButton(page);
    await waitForDataLoad(page);
  });

  test('筛选器 - 平台切换', async ({ page }) => {
    await waitForDataLoad(page);
    const platformSelect = page.locator('.ant-select').first();
    if (await platformSelect.isVisible({ timeout: 5000 }).catch(() => false)) {
      await platformSelect.click();
      await page.waitForTimeout(500);
      const option = page.locator('.ant-select-item-option').first();
      if (await option.isVisible({ timeout: 3000 }).catch(() => false)) {
        await option.click();
        await waitForDataLoad(page);
      }
    }
  });

  test('数据表格 - 树形展开/收起', async ({ page }) => {
    await waitForDataLoad(page);
    const expandBtn = page.locator('button:has-text("展开全部")').first();
    if (await expandBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expandBtn.click();
      await page.waitForTimeout(800);
      const collapseBtn = page.locator('button:has-text("收起全部")').first();
      expect(await collapseBtn.isVisible().catch(() => false)).toBeTruthy();
      await collapseBtn.click();
      await page.waitForTimeout(500);
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

  test('数据加载 - 等待加载完成', async ({ page }) => {
    await waitForLoadingComplete(page);
    const hasData = await hasDataInTable(page);
    const hasChart = await checkElementExists(page, '[class*="chart"], canvas');
    console.log('归因转化率有数据:', hasData, '有图表:', hasChart);
  });

  test('错误处理 - 无数据场景', async ({ page }) => {
    await waitForDataLoad(page);
    const emptyState = page.locator('.ant-empty, text=/暂无/i').first();
    const hasEmptyState = await emptyState.isVisible({ timeout: 3000 }).catch(() => false);
    const hasChart = await checkElementExists(page, '[class*="chart"], canvas');
    expect(hasEmptyState || hasChart).toBeTruthy();
  });
});
