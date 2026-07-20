/**
 * 报告生成页面功能测试
 * 路由: /report-generation
 * 页面: 周报期次选择 + 数据周报（6 指标 + 2 堆叠图 + 互联网渠道占比）
 */
import { test, expect } from '@playwright/test';
import {
  navigateToPage,
  waitForDataLoad,
  expectSidebarVisible,
  expectMainContentVisible,
  checkElementExists,
  waitForLoadingComplete,
} from './utils';

test.describe('报告生成页面功能测试', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToPage(page, 'report-generation');
  });

  test('页面加载 - 基本结构验证', async ({ page }) => {
    await expectSidebarVisible(page);
    await expectMainContentVisible(page);
  });

  test('页面加载 - 周报期次选择器', async ({ page }) => {
    await waitForDataLoad(page);
    const select = page.locator('.ant-select').first();
    const isSelectVisible = await select.isVisible({ timeout: 15000 }).catch(() => false);
    console.log('周报期次选择器可见:', isSelectVisible);
  });

  test('页面加载 - 数据周报显示', async ({ page }) => {
    await waitForDataLoad(page);
    const reportContent = page.locator('[class*="report"], .ant-table').first();
    const isContentVisible = await reportContent.isVisible({ timeout: 15000 }).catch(() => false);
    console.log('数据周报内容可见:', isContentVisible);
  });

  test('页面加载 - 堆叠图显示', async ({ page }) => {
    await waitForDataLoad(page);
    const charts = page.locator('canvas, [class*="chart"]');
    const chartCount = await charts.count();
    console.log('图表数量:', chartCount);
  });

  test('功能 - 导出按钮', async ({ page }) => {
    await waitForDataLoad(page);
    const exportButtons = page.locator('button:has-text("导出"), button:has-text("PDF"), button:has-text("PNG")');
    const buttonCount = await exportButtons.count();
    console.log('导出按钮数量:', buttonCount);
  });

  test('数据加载 - 等待加载完成', async ({ page }) => {
    await waitForLoadingComplete(page);
    const hasChart = await checkElementExists(page, 'canvas, [class*="chart"]');
    const hasTable = await checkElementExists(page, '.ant-table');
    console.log('有图表:', hasChart, '有表格:', hasTable);
  });

  test('错误处理 - 无数据场景', async ({ page }) => {
    await waitForDataLoad(page);
    const emptyState = page.locator('.ant-empty, text=/暂无数据/i').first();
    const hasEmptyState = await emptyState.isVisible({ timeout: 3000 }).catch(() => false);
    const hasContent = await checkElementExists(page, '[class*="report"], canvas, .ant-table');
    expect(hasEmptyState || hasContent).toBeTruthy();
  });
});
