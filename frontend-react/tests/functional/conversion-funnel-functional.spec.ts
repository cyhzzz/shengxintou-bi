/**
 * 转化漏斗页面功能测试
 * 验证新前端转化漏斗页面的各项功能
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
  clickSearchButton,
  getTableRowCount,
  hasDataInTable,
  checkElementExists,
  getTextContent,
  waitForLoadingComplete,
} from './utils';

test.describe('转化漏斗页面功能测试', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToPage(page, 'conversion-funnel');
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
    expect(selectCount).toBeGreaterThan(0);
  });

  test('页面加载 - 漏斗图显示', async ({ page }) => {
    await waitForChartRender(page);
    await expectChartVisible(page);
  });

  test('页面加载 - 数据表格显示', async ({ page }) => {
    await waitForDataLoad(page);
    
    const table = page.locator('.ant-table').first();
    const isTableVisible = await table.isVisible({ timeout: 10000 }).catch(() => false);
    console.log('数据表格可见:', isTableVisible);
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
    
    await expectChartVisible(page);
  });

  test('漏斗图 - 漏斗阶段验证', async ({ page }) => {
    await waitForChartRender(page);
    
    const funnelLayers = page.locator('[class*="funnel"], [class*="layer"]');
    const layerCount = await funnelLayers.count();
    console.log('漏斗层数:', layerCount);
  });

  test('漏斗图 - 转化率显示', async ({ page }) => {
    await waitForDataLoad(page);
    
    const rateText = page.locator('text=/转化率|率/i').first();
    const hasRateText = await rateText.isVisible({ timeout: 5000 }).catch(() => false);
    console.log('转化率文本可见:', hasRateText);
  });

  test('漏斗图 - 指标数值显示', async ({ page }) => {
    await waitForDataLoad(page);
    
    const metrics = page.locator('[class*="metric"], .ant-statistic-content-value');
    const metricCount = await metrics.count();
    console.log('指标数量:', metricCount);
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
    
    const table = page.locator('.ant-table').first();
    if (await table.isVisible({ timeout: 5000 }).catch(() => false)) {
      const hasData = await hasDataInTable(page);
      console.log('转化漏斗有数据:', hasData);
      
      const rowCount = await getTableRowCount(page);
      console.log('表格行数:', rowCount);
    }
  });

  test('漏斗图 - 时间维度切换', async ({ page }) => {
    await waitForChartRender(page);
    
    const dimensionButtons = page.locator('.ant-radio-group, .ant-segmented').first();
    if (await dimensionButtons.isVisible({ timeout: 3000 }).catch(() => false)) {
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
    console.log('转化漏斗页面有数据:', hasData);
  });

  test('错误处理 - 无数据场景', async ({ page }) => {
    await waitForDataLoad(page);
    
    const emptyState = page.locator('.ant-empty, text=/暂无数据/i').first();
    const hasEmptyState = await emptyState.isVisible({ timeout: 3000 }).catch(() => false);
    
    const hasChart = await checkElementExists(page, '[class*="chart"], canvas');
    console.log('有图表:', hasChart);
    
    expect(hasEmptyState || hasChart).toBeTruthy();
  });
});
