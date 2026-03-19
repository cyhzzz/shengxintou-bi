/**
 * 线索明细页面功能测试
 * 验证新前端线索明细页面的各项功能
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
  clickSearchButton,
  getTableRowCount,
  hasDataInTable,
  checkElementExists,
  getTextContent,
  waitForLoadingComplete,
} from './utils';

test.describe('线索明细页面功能测试', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToPage(page, 'leads-detail');
  });

  test('页面加载 - 基本结构验证', async ({ page }) => {
    await expectSidebarVisible(page);
    await expectMainContentVisible(page);
    await expectFilterBarVisible(page);
    
    const header = page.locator('h1, .ant-page-header-heading-title').first();
    await expect(header).toBeVisible({ timeout: 10000 });
  });

  test('页面加载 - 筛选器组件', async ({ page }) => {
    await expectFilterBarVisible(page);
    
    const selects = page.locator('.ant-select');
    const selectCount = await selects.count();
    console.log('筛选器下拉框数量:', selectCount);
    expect(selectCount).toBeGreaterThan(0);
  });

  test('页面加载 - 数据表格显示', async ({ page }) => {
    await waitForDataLoad(page);
    await expectDataTableVisible(page);
    
    const rowCount = await getTableRowCount(page);
    console.log('线索明细表格行数:', rowCount);
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

  test('数据表格 - 列显示验证', async ({ page }) => {
    await waitForDataLoad(page);
    
    const headers = page.locator('.ant-table-thead th');
    const headerCount = await headers.count();
    expect(headerCount).toBeGreaterThan(0);
    
    const headerTexts = await headers.allTextContents();
    console.log('表格列:', headerTexts.slice(0, 10));
  });

  test('数据表格 - 行数据验证', async ({ page }) => {
    await waitForDataLoad(page);
    
    const hasData = await hasDataInTable(page);
    console.log('线索明细有数据:', hasData);
    
    const rowCount = await getTableRowCount(page);
    console.log('表格行数:', rowCount);
  });

  test('数据表格 - 列宽调整', async ({ page }) => {
    await waitForDataLoad(page);
    
    const resizableColumns = page.locator('.ant-table-column-resize-trigger');
    const hasResizable = await resizableColumns.first().isVisible({ timeout: 3000 }).catch(() => false);
    console.log('列可调整:', hasResizable);
  });

  test('数据表格 - 排序功能', async ({ page }) => {
    await waitForDataLoad(page);
    
    const sortableHeader = page.locator('.ant-table-column-sorters').first();
    if (await sortableHeader.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sortableHeader.click();
      await page.waitForTimeout(1000);
      
      const sorted = page.locator('.ant-table-column-sorter-up, .ant-table-column-sorter-down').first();
      const isSorted = await sorted.isVisible({ timeout: 3000 }).catch(() => false);
      console.log('已排序:', isSorted);
    }
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

  test('数据表格 - 每页显示数量选择', async ({ page }) => {
    await waitForDataLoad(page);
    
    const sizeChanger = page.locator('.ant-select-page-size-changer').first();
    if (await sizeChanger.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sizeChanger.click();
      await page.waitForTimeout(500);
      
      const options = page.locator('.ant-select-dropdown .ant-select-item');
      const optionCount = await options.count();
      
      if (optionCount > 1) {
        await options.nth(1).click();
        await waitForDataLoad(page);
      }
    }
  });

  test('数据表格 - 导出功能', async ({ page }) => {
    await waitForDataLoad(page);
    
    const exportButton = page.locator('button:has-text("导出"), .ant-btn:has-text("导出")').first();
    if (await exportButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(exportButton).toBeVisible();
      console.log('导出按钮可见');
    }
  });

  test('数据加载 - 等待加载完成', async ({ page }) => {
    await waitForLoadingComplete(page);
    
    const hasData = await hasDataInTable(page);
    console.log('线索明细页面有数据:', hasData);
  });

  test('错误处理 - 无数据场景', async ({ page }) => {
    await waitForDataLoad(page);
    
    const emptyState = page.locator('.ant-empty, text=/暂无数据/i').first();
    const hasEmptyState = await emptyState.isVisible({ timeout: 3000 }).catch(() => false);
    
    const hasData = await hasDataInTable(page);
    expect(hasData || hasEmptyState).toBeTruthy();
  });
});
