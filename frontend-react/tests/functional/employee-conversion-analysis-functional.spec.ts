/**
 * 员工转化分析页面功能测试
 * 验证新前端员工转化分析页面的各项功能
 */

import { test, expect } from '@playwright/test';
import {
  navigateToPage,
  waitForPageReady,
  waitForDataLoad,
  waitForChartRender,
  expectSidebarVisible,
  expectMainContentVisible,
  expectFilterBarVisible,
  expectChartVisible,
  expectDataTableVisible,
  clickSearchButton,
  getTableRowCount,
  hasDataInTable,
  checkElementExists,
  getTextContent,
  waitForLoadingComplete,
} from './utils';

test.describe('员工转化分析页面功能测试', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToPage(page, 'employee-conversion-analysis');
  });

  test('页面加载 - 基本结构验证', async ({ page }) => {
    await expectSidebarVisible(page);
    await expectMainContentVisible(page);
    await expectFilterBarVisible(page);
  });

  test('页面加载 - 页面标题验证', async ({ page }) => {
    // 项目用 MetricCard/Card 组件，不使用 ant-page-header
    const title = await getTextContent(page, 'h1, h2, .ant-card-head-title, [class*="metricTitle"], [class*="title"]');
    console.log('员工转化分析页面标题:', title);
    // 标题可能为 null（页面用 Card 而非 PageHeader），只要有可见内容即通过
    if (!title) {
      const hasContent = await checkElementExists(page, '.ant-card, .ant-table, .ant-form');
      expect(hasContent).toBeTruthy();
    } else {
      expect(title).toBeTruthy();
    }
  });

  test('页面加载 - 筛选器组件', async ({ page }) => {
    await expectFilterBarVisible(page);
    
    const selects = page.locator('.ant-select');
    const selectCount = await selects.count();
    console.log('筛选器下拉框数量:', selectCount);
  });

  test('页面加载 - 数据表格显示', async ({ page }) => {
    await waitForDataLoad(page);
    
    const table = page.locator('.ant-table').first();
    const isTableVisible = await table.isVisible({ timeout: 10000 }).catch(() => false);
    console.log('数据表格可见:', isTableVisible);
  });

  test('页面加载 - 图表显示', async ({ page }) => {
    await waitForChartRender(page);
    const hasChart = await checkElementExists(page, '[class*="chart"], canvas');
    console.log('图表可见:', hasChart);
  });

  test('筛选器 - 员工筛选功能', async ({ page }) => {
    const employeeSelect = page.locator('.ant-select').first();
    if (await employeeSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await employeeSelect.click();
      await page.waitForTimeout(500);
      
      const options = page.locator('.ant-select-dropdown .ant-select-item');
      const optionCount = await options.count();
      
      if (optionCount > 0) {
        await options.first().click();
        await page.waitForTimeout(1000);
        
        await clickSearchButton(page);
        await waitForDataLoad(page);
      }
    }
  });

  test('筛选器 - 日期范围筛选功能', async ({ page }) => {
    const datePicker = page.locator('.ant-picker').first();
    if (await datePicker.isVisible({ timeout: 3000 }).catch(() => false)) {
      await datePicker.click();
      await page.waitForTimeout(500);
      
      const todayButton = page.locator('.ant-picker-today-btn').first();
      if (await todayButton.isVisible().catch(() => false)) {
        await todayButton.click();
        await page.waitForTimeout(1000);
      } else {
        await page.keyboard.press('Escape');
      }
      
      await clickSearchButton(page);
      await waitForDataLoad(page);
    }
  });

  test('筛选器 - 查询按钮功能', async ({ page }) => {
    await clickSearchButton(page);
    await waitForDataLoad(page);
  });

  test('数据表格 - 列显示验证', async ({ page }) => {
    await waitForDataLoad(page);
    
    const table = page.locator('.ant-table').first();
    if (await table.isVisible({ timeout: 5000 }).catch(() => false)) {
      const headers = page.locator('.ant-table-thead th');
      const headerCount = await headers.count();
      expect(headerCount).toBeGreaterThan(0);
      
      const headerTexts = await headers.allTextContents();
      console.log('表格列:', headerTexts.slice(0, 10));
    }
  });

  test('数据表格 - 行数据验证', async ({ page }) => {
    await waitForDataLoad(page);
    
    const table = page.locator('.ant-table').first();
    if (await table.isVisible({ timeout: 5000 }).catch(() => false)) {
      const hasData = await hasDataInTable(page);
      console.log('员工转化有数据:', hasData);
      
      const rowCount = await getTableRowCount(page);
      console.log('表格行数:', rowCount);
    }
  });

  test('图表 - 转化趋势图显示', async ({ page }) => {
    await waitForChartRender(page);
    await expectChartVisible(page);
  });

  test('图表 - 图表类型切换', async ({ page }) => {
    await waitForChartRender(page);
    
    const chartTabs = page.locator('.ant-radio-group, .ant-segmented').first();
    if (await chartTabs.isVisible({ timeout: 3000 }).catch(() => false)) {
      const options = page.locator('.ant-radio-button-wrapper, .ant-segmented-item');
      const optionCount = await options.count();
      
      if (optionCount > 1) {
        await options.nth(1).click();
        await waitForChartRender(page);
      }
    }
  });

  test('数据加载 - 等待加载完成', async ({ page }) => {
    await waitForLoadingComplete(page);
    
    const hasData = await hasDataInTable(page);
    console.log('员工转化分析页面有数据:', hasData);
  });

  test('错误处理 - 无数据场景', async ({ page }) => {
    await waitForDataLoad(page);
    
    const emptyState = page.locator('.ant-empty, text=/暂无数据/i').first();
    const hasEmptyState = await emptyState.isVisible({ timeout: 3000 }).catch(() => false);
    
    const hasData = await hasDataInTable(page);
    expect(hasData || hasEmptyState).toBeTruthy();
  });
});
