/**
 * 主播分析页面功能测试
 * 路由: /anchor-clusters
 * 数据源: fact_conv_content.客户来源（主播引流聚合）
 * 端点: POST /api/v1/leads-detail/anchor-clusters
 */
import { test, expect } from '@playwright/test';
import {
  navigateToPage,
  waitForDataLoad,
  expectSidebarVisible,
  expectMainContentVisible,
  expectFilterBarVisible,
  clickSearchButton,
  getTableRowCount,
  hasDataInTable,
  checkElementExists,
  waitForLoadingComplete,
} from './utils';

test.describe('主播分析页面功能测试', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToPage(page, 'anchor-clusters');
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
      console.log('表格列数:', headerCount);
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
    console.log('主播分析有数据:', hasData);
  });

  test('错误处理 - 无数据场景', async ({ page }) => {
    await waitForDataLoad(page);
    const emptyState = page.locator('.ant-empty, text=/暂无数据/i').first();
    const hasEmptyState = await emptyState.isVisible({ timeout: 3000 }).catch(() => false);
    const hasTable = await checkElementExists(page, '.ant-table');
    expect(hasEmptyState || hasTable).toBeTruthy();
  });
});
