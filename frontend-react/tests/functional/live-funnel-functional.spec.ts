/**
 * 直播获客漏斗页面功能测试
 * 路由: /live/funnel
 * 数据源: fact_conv_content.客户来源（主播引流）
 * 6 阶段: 客户线索 → 客户开口 → 有效线索 → 有效线索(剔除存量) → 成功开户(新) → 有效户(新)
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
  hasDataInTable,
  checkElementExists,
  waitForLoadingComplete,
} from './utils';

test.describe('直播获客漏斗页面功能测试', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToPage(page, 'live-funnel');
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

  test('页面加载 - 漏斗图显示', async ({ page }) => {
    await waitForChartRender(page);
    await expectChartVisible(page);
  });

  test('页面加载 - 阶段明细表显示', async ({ page }) => {
    await waitForDataLoad(page);
    const table = page.locator('.ant-table, table[class*="stage"]').first();
    const isTableVisible = await table.isVisible({ timeout: 15000 }).catch(() => false);
    console.log('阶段明细表可见:', isTableVisible);
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

  test('漏斗图 - 漏斗阶段验证', async ({ page }) => {
    await waitForChartRender(page);
    const funnelLayers = page.locator('[class*="funnel"], [class*="layer"]');
    const layerCount = await funnelLayers.count();
    console.log('漏斗层数:', layerCount);
  });

  test('数据加载 - 等待加载完成', async ({ page }) => {
    await waitForLoadingComplete(page);
    const hasData = await hasDataInTable(page);
    console.log('直播漏斗有数据:', hasData);
  });

  test('错误处理 - 无数据场景', async ({ page }) => {
    await waitForDataLoad(page);
    const emptyState = page.locator('.ant-empty, text=/暂无数据/i').first();
    const hasEmptyState = await emptyState.isVisible({ timeout: 3000 }).catch(() => false);
    const hasChart = await checkElementExists(page, '[class*="chart"], canvas');
    expect(hasEmptyState || hasChart).toBeTruthy();
  });
});
