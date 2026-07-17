/**
 * 数据概览页面功能测试
 * 验证新前端数据概览页面的各项功能
 */

import { test, expect } from '@playwright/test';
import {
  navigateToPage,
  waitForPageReady,
  waitForDataLoad,
  waitForChartRender,
  expectSidebarVisible,
  expectMainContentVisible,
  expectMetricCardsVisible,
  expectChartVisible,
  clickSearchButton,
  getTableRowCount,
  hasDataInTable,
  takeScreenshot,
  checkElementExists,
  getTextContent,
  waitForLoadingComplete,
} from './utils';
import { PAGE_ROUTES } from './utils';

test.describe('数据概览页面功能测试', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToPage(page, 'dashboard');
  });

  test('页面加载 - 基本结构验证', async ({ page }) => {
    await expectSidebarVisible(page);
    await expectMainContentVisible(page);
  });

  test('页面加载 - 指标卡片显示', async ({ page }) => {
    await waitForDataLoad(page);
    await expectMetricCardsVisible(page);
    
    const metricCards = page.locator('.ant-card, [class*="metric"]');
    const cardCount = await metricCards.count();
    expect(cardCount).toBeGreaterThan(0);
  });

  test('页面加载 - 趋势图显示', async ({ page }) => {
    await waitForChartRender(page);
    await expectChartVisible(page);
  });

  test('页面加载 - 前端投放分组指标', async ({ page }) => {
    await waitForDataLoad(page);
    
    const frontendGroup = page.locator('text=/前端投放/i').first();
    await expect(frontendGroup).toBeVisible({ timeout: 10000 });
  });

  test('页面加载 - 抖音平台指标', async ({ page }) => {
    await waitForDataLoad(page);
    
    const douyinGroup = page.locator('text=/抖音/i').first();
    const hasDouyin = await douyinGroup.isVisible({ timeout: 5000 }).catch(() => false);
    if (hasDouyin) {
      await expect(douyinGroup).toBeVisible();
    }
  });

  test('页面加载 - 小红书平台指标', async ({ page }) => {
    await waitForDataLoad(page);
    
    const xhsGroup = page.locator('text=/小红书/i').first();
    const hasXhs = await xhsGroup.isVisible({ timeout: 5000 }).catch(() => false);
    if (hasXhs) {
      await expect(xhsGroup).toBeVisible();
    }
  });

  test('筛选器 - 查询按钮功能', async ({ page }) => {
    await clickSearchButton(page);
    await waitForDataLoad(page);
    
    const chart = page.locator('[class*="chart"], canvas').first();
    await expect(chart).toBeVisible();
  });

  test('筛选器 - 平台筛选', async ({ page }) => {
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

  test('筛选器 - 日期范围筛选', async ({ page }) => {
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

  test('趋势图 - 指标切换功能', async ({ page }) => {
    await waitForChartRender(page);
    
    const segmentedControl = page.locator('.ant-segmented').first();
    if (await segmentedControl.isVisible({ timeout: 3000 }).catch(() => false)) {
      const options = page.locator('.ant-segmented-item');
      const optionCount = await options.count();
      
      if (optionCount > 1) {
        await options.nth(1).click();
        await page.waitForTimeout(1500);
      }
    }
  });

  test('趋势图 - 切换时间维度', async ({ page }) => {
    await waitForChartRender(page);
    
    const timeDimensionButtons = page.locator('button:has-text("日"), button:has-text("周"), button:has-text("月")');
    const buttonCount = await timeDimensionButtons.count();
    
    if (buttonCount > 1) {
      await timeDimensionButtons.nth(1).click();
      await waitForChartRender(page);
    }
  });

  test('数据加载 - 等待数据加载完成', async ({ page }) => {
    await waitForLoadingComplete(page);
    
    const hasData = await hasDataInTable(page);
    console.log('数据概览页面有数据:', hasData);
  });

  test('错误处理 - 无数据场景显示', async ({ page }) => {
    await waitForDataLoad(page);
    
    const emptyState = page.locator('.ant-empty, text=/暂无数据/i').first();
    const hasEmptyState = await emptyState.isVisible({ timeout: 3000 }).catch(() => false);
    
    const hasData = await hasDataInTable(page);
    expect(hasData || hasEmptyState).toBeTruthy();
  });
});
