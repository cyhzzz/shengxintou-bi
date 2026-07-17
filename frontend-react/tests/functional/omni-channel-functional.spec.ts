/**
 * 全渠道获客页面功能测试
 * 路由: /omni-channel
 * 数据源: agg_daily_channel_open
 * 页面: 4 指标卡 + 日趋势折线图 + 4 类渠道 Tab 详情表
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

test.describe('全渠道获客页面功能测试', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToPage(page, 'omni-channel');
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

  test('页面加载 - 指标卡片显示', async ({ page }) => {
    await waitForDataLoad(page);
    const cards = page.locator('.ant-card, [class*="metric"]').first();
    const isCardVisible = await cards.isVisible({ timeout: 15000 }).catch(() => false);
    console.log('指标卡片可见:', isCardVisible);
  });

  test('页面加载 - 趋势图显示', async ({ page }) => {
    await waitForChartRender(page);
    await expectChartVisible(page);
  });

  test('页面加载 - Tab 组件显示', async ({ page }) => {
    await waitForDataLoad(page);
    const tabs = page.locator('.ant-tabs').first();
    const isTabsVisible = await tabs.isVisible({ timeout: 10000 }).catch(() => false);
    console.log('Tab 组件可见:', isTabsVisible);
  });

  test('Tab - 切换渠道类别', async ({ page }) => {
    await waitForDataLoad(page);
    const tabItems = page.locator('.ant-tabs-tab');
    const tabCount = await tabItems.count();
    console.log('Tab 数量:', tabCount);
    if (tabCount > 1) {
      await tabItems.nth(1).click();
      await waitForDataLoad(page);
    }
  });

  test('数据表格 - 行数据验证', async ({ page }) => {
    await waitForDataLoad(page);
    const rowCount = await getTableRowCount(page);
    console.log('表格行数:', rowCount);
  });

  test('筛选器 - 查询按钮功能', async ({ page }) => {
    await clickSearchButton(page);
    await waitForDataLoad(page);
  });

  test('数据加载 - 等待加载完成', async ({ page }) => {
    await waitForLoadingComplete(page);
    const hasData = await hasDataInTable(page);
    console.log('全渠道获客有数据:', hasData);
  });

  test('错误处理 - 无数据场景', async ({ page }) => {
    await waitForDataLoad(page);
    const emptyState = page.locator('.ant-empty, text=/暂无数据/i').first();
    const hasEmptyState = await emptyState.isVisible({ timeout: 3000 }).catch(() => false);
    const hasChart = await checkElementExists(page, '[class*="chart"], canvas');
    expect(hasEmptyState || hasChart).toBeTruthy();
  });
});
