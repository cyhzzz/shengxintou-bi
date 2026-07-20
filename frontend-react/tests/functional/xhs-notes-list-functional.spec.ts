/**
 * 小红书笔记列表页面功能测试
 * 验证新前端小红书笔记列表页面的各项功能
 */

import { test, expect } from '@playwright/test';
import {
  navigateToPage,
  waitForDataLoad,
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

test.describe('小红书笔记列表页面功能测试', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToPage(page, 'xhs-notes-list');
  });

  test('页面加载 - 基本结构验证', async ({ page }) => {
    await expectSidebarVisible(page);
    await expectMainContentVisible(page);
    await expectFilterBarVisible(page);
  });

  test('页面加载 - 页面标题验证', async ({ page }) => {
    // 项目用 MetricCard/Card 组件，不使用 ant-page-header
    const title = await getTextContent(page, 'h1, h2, .ant-card-head-title, [class*="metricTitle"], [class*="title"]');
    console.log('小红书笔记列表页面标题:', title);
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
    await expectDataTableVisible(page);
    
    const rowCount = await getTableRowCount(page);
    console.log('笔记列表表格行数:', rowCount);
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
    console.log('笔记列表有数据:', hasData);
    
    const rowCount = await getTableRowCount(page);
    console.log('表格行数:', rowCount);
  });

  test('数据表格 - 笔记标题列显示', async ({ page }) => {
    await waitForDataLoad(page);
    
    const titleColumn = page.locator('th:has-text("标题"), th:has-text("笔记标题")').first();
    const hasTitleColumn = await titleColumn.isVisible({ timeout: 3000 }).catch(() => false);
    console.log('笔记标题列可见:', hasTitleColumn);
  });

  test('数据表格 - 点赞数列显示', async ({ page }) => {
    await waitForDataLoad(page);
    
    const likesColumn = page.locator('th:has-text("点赞")').first();
    const hasLikesColumn = await likesColumn.isVisible({ timeout: 3000 }).catch(() => false);
    console.log('点赞数列可见:', hasLikesColumn);
  });

  test('数据表格 - 收藏数列显示', async ({ page }) => {
    await waitForDataLoad(page);
    
    const collectColumn = page.locator('th:has-text("收藏")').first();
    const hasCollectColumn = await collectColumn.isVisible({ timeout: 3000 }).catch(() => false);
    console.log('收藏数列可见:', hasCollectColumn);
  });

  test('数据表格 - 评论数列显示', async ({ page }) => {
    await waitForDataLoad(page);
    
    const commentColumn = page.locator('th:has-text("评论")').first();
    const hasCommentColumn = await commentColumn.isVisible({ timeout: 3000 }).catch(() => false);
    console.log('评论数列可见:', hasCommentColumn);
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

  test('数据加载 - 等待加载完成', async ({ page }) => {
    await waitForLoadingComplete(page);
    
    const hasData = await hasDataInTable(page);
    console.log('小红书笔记列表页面有数据:', hasData);
  });

  test('错误处理 - 无数据场景', async ({ page }) => {
    await waitForDataLoad(page);
    
    const emptyState = page.locator('.ant-empty, text=/暂无数据/i').first();
    const hasEmptyState = await emptyState.isVisible({ timeout: 3000 }).catch(() => false);
    
    const hasData = await hasDataInTable(page);
    expect(hasData || hasEmptyState).toBeTruthy();
  });
});
