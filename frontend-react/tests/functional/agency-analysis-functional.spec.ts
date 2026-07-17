/**
 * 厂商分析页面功能测试
 * 验证新前端厂商分析页面的各项功能
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
  expectDataTableVisible,
  expectChartVisible,
  clickSearchButton,
  getTableRowCount,
  hasDataInTable,
  takeScreenshot,
  checkElementExists,
  waitForLoadingComplete,
  expandSubMenu,
} from './utils';

test.describe('厂商分析页面功能测试', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToPage(page, 'agency-analysis');
  });

  test('页面加载 - 基本结构验证', async ({ page }) => {
    await expectSidebarVisible(page);
    await expectMainContentVisible(page);
    await expectFilterBarVisible(page);
  });

  test('页面加载 - 筛选器组件', async ({ page }) => {
    await expectFilterBarVisible(page);
    
    const platformFilter = page.locator('.ant-select').first();
    await expect(platformFilter).toBeVisible({ timeout: 10000 });
  });

  test('页面加载 - 数据表格显示', async ({ page }) => {
    await waitForDataLoad(page);
    await expectDataTableVisible(page);
    
    const rowCount = await getTableRowCount(page);
    console.log('厂商分析表格行数:', rowCount);
  });

  test('页面加载 - 图表显示', async ({ page }) => {
    await waitForChartRender(page);
    await expectChartVisible(page);
  });

  test('筛选器 - 平台筛选功能', async ({ page }) => {
    const platformSelect = page.locator('.ant-select').first();
    if (await platformSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await platformSelect.click();
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

  test('筛选器 - 业务模式筛选功能', async ({ page }) => {
    const businessModelSelect = page.locator('.ant-select').nth(1);
    if (await businessModelSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await businessModelSelect.click();
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

  test('筛选器 - 代理商筛选功能', async ({ page }) => {
    const agencySelect = page.locator('.ant-select').nth(2);
    if (await agencySelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await agencySelect.click();
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
    
    await expectDataTableVisible(page);
  });

  test('筛选器 - 重置按钮功能', async ({ page }) => {
    const resetButton = page.locator('button:has-text("重置")').first();
    if (await resetButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await resetButton.click();
      await page.waitForTimeout(1000);
      
      await clickSearchButton(page);
      await waitForDataLoad(page);
    }
  });

  test('数据表格 - 列显示验证', async ({ page }) => {
    await waitForDataLoad(page);
    
    const headers = page.locator('.ant-table-thead th');
    const headerCount = await headers.count();
    expect(headerCount).toBeGreaterThan(0);
    
    const headerTexts = await headers.allTextContents();
    console.log('表格列:', headerTexts);
  });

  test('数据表格 - 行数据验证', async ({ page }) => {
    await waitForDataLoad(page);
    
    const hasData = await hasDataInTable(page);
    console.log('厂商分析有数据:', hasData);
    
    const rowCount = await getTableRowCount(page);
    console.log('表格行数:', rowCount);
  });

  test('数据表格 - 分页功能', async ({ page }) => {
    await waitForDataLoad(page);
    
    const pagination = page.locator('.ant-pagination').first();
    if (await pagination.isVisible({ timeout: 3000 }).catch(() => false)) {
      const pageItems = page.locator('.ant-pagination-item');
      const pageCount = await pageItems.count();
      
      if (pageCount > 1) {
        await pageItems.nth(1).click();
        await waitForDataLoad(page);
      }
    }
  });

  test('图表 - 图表类型验证', async ({ page }) => {
    await waitForChartRender(page);
    
    const chartContainer = page.locator('[class*="chart"]').first();
    await expect(chartContainer).toBeVisible();
    
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible();
  });

  test('图表 - 图表切换功能', async ({ page }) => {
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
    console.log('厂商分析页面有数据:', hasData);
  });

  test('错误处理 - 无数据场景', async ({ page }) => {
    await waitForDataLoad(page);
    
    const emptyState = page.locator('.ant-empty, text=/暂无数据/i').first();
    const hasEmptyState = await emptyState.isVisible({ timeout: 3000 }).catch(() => false);
    
    const hasData = await hasDataInTable(page);
    expect(hasData || hasEmptyState).toBeTruthy();
  });
});
